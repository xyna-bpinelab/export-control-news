import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deduplicateItems } from '@/lib/collectors/dedup'
import { parseFlexibleDate } from '@/lib/utils/date'
import { cleanText } from '@/lib/utils/text'
import type { CollectedItem } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const OFAC_ACTIONS_URL = 'https://home.treasury.gov/policy-issues/financial-sanctions/recent-actions'

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const supabase = createServiceRoleClient()

  // OFAC の source_id を取得
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('slug', 'ofac')
    .single()

  if (!source) {
    return NextResponse.json({ error: 'OFAC source not found' }, { status: 500 })
  }

  const url = page > 0 ? `${OFAC_ACTIONS_URL}?page=${page}` : OFAC_ACTIONS_URL

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)',
      'Accept': 'text/html',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `OFAC fetch error: ${res.status}` }, { status: 500 })
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  const items: CollectedItem[] = []

  // OFAC recent actions のリスト構造を解析
  // 各アクションは <article> または <li> または table行 で構成される
  const selectors = [
    'article.views-row',
    '.view-content .views-row',
    'table.views-table tbody tr',
    '.field-content a',
  ]

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el)
      const $link = $el.find('a').first()
      const href = $link.attr('href')
      if (!href) return

      const fullUrl = href.startsWith('http')
        ? href
        : `https://home.treasury.gov${href}`

      const title = cleanText($link.text() || $el.find('h3, h2, .title').first().text())
      if (!title || title.length < 5) return

      const dateText = $el.find('time, .date-display-single, .views-field-field-date, span.date').first().text()
        || $el.attr('data-date')
        || ''
      const published_at = dateText ? parseFlexibleDate(dateText) : null

      items.push({
        title,
        url: fullUrl,
        content_text: null,
        published_at,
        lang: 'en' as const,
        category: 'sanction' as const,
      })
    })
    if (items.length > 0) break
  }

  // 次ページの存在確認
  const hasMore = $('a[rel="next"], .pager__item--next a, li.pager-next a').length > 0

  // 重複排除
  const newItems = await deduplicateItems(supabase, items)

  if (newItems.length > 0) {
    const rows = newItems.map((item) => ({
      source_id: source.id,
      title: item.title,
      url: item.url,
      url_hash: item.url_hash,
      content_text: item.content_text,
      published_at: item.published_at?.toISOString() ?? null,
      lang: item.lang,
      category: item.category ?? null,
      tags: [],
      status: 'collected',
    }))

    const { error } = await supabase.from('articles').upsert(rows, {
      onConflict: 'url_hash',
      ignoreDuplicates: true,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

    return NextResponse.json({
      ok: true,
      page,
      found: items.length,
      inserted: newItems.length,
      has_more: hasMore,
      next_page: hasMore ? page + 1 : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
