import type { SupabaseClient } from '@supabase/supabase-js'
import type { Source, CollectedItem } from '@/types'
import { fetchRssFeed } from './rss'
import { MetiScraper } from './sources/meti'
import { MofaScraper } from './sources/mofa'
import { CistecScraper } from './sources/cistec'
import { deduplicateItems } from './dedup'

const SCRAPERS: Record<string, { scrape: (url: string) => Promise<CollectedItem[]> }> = {
  meti: new MetiScraper(),
  mofa: new MofaScraper(),
  cistec: new CistecScraper(),
}

export interface CollectResult {
  sourceId: string
  slug: string
  found: number
  inserted: number
  error?: string
}

/**
 * 1つの収集元から記事を収集してDBに保存
 */
export async function collectFromSource(
  supabase: SupabaseClient,
  source: Source,
): Promise<CollectResult> {
  const start = Date.now()
  const base: CollectResult = { sourceId: source.id, slug: source.slug, found: 0, inserted: 0 }

  try {
    let items: CollectedItem[] = []

    if (source.collector_type === 'rss' && source.feed_url) {
      const lang = source.country_code === 'JP' ? 'ja' : 'en'
      items = await fetchRssFeed(source.feed_url, lang)
    } else if (source.collector_type === 'scraper' && source.scrape_url) {
      const scraper = SCRAPERS[source.slug]
      if (!scraper) throw new Error(`No scraper for slug: ${source.slug}`)
      items = await scraper.scrape(source.scrape_url)
    } else {
      // email は webhook で非同期受信するためここでは何もしない
      return base
    }

    base.found = items.length
    if (items.length === 0) return base

    // 重複排除
    const newItems = await deduplicateItems(supabase, items)
    if (newItems.length === 0) return base

    // DB に INSERT
    const rows = newItems.map((item) => ({
      source_id: source.id,
      title: item.title,
      url: item.url,
      url_hash: item.url_hash,
      content_text: item.content_text,
      published_at: item.published_at?.toISOString() ?? null,
      lang: item.lang,
      category: item.category ?? null,
      tags: item.tags ?? [],
      status: 'collected',
    }))

    const { error } = await supabase.from('articles').insert(rows)
    if (error) throw new Error(error.message)

    base.inserted = newItems.length

    // ログ記録
    await supabase.from('collection_logs').insert({
      source_id: source.id,
      job_type: source.collector_type,
      status: 'success',
      articles_found: base.found,
      articles_new: base.inserted,
      duration_ms: Date.now() - start,
    })

    return base
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    base.error = errorMessage

    await supabase.from('collection_logs').insert({
      source_id: source.id,
      job_type: source.collector_type,
      status: 'error',
      articles_found: 0,
      articles_new: 0,
      error_message: errorMessage,
      duration_ms: Date.now() - start,
    })

    return base
  }
}
