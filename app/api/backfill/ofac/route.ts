import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deduplicateItems } from '@/lib/collectors/dedup'
import { cleanText } from '@/lib/utils/text'
import type { CollectedItem } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// OFACはページネーション非対応。最新10件のみ取得できる。
const OFAC_ACTIONS_URL = 'https://ofac.treasury.gov/recent-actions'

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()

    const { data: source } = await supabase
      .from('sources')
      .select('id')
      .eq('slug', 'ofac')
      .single()

    if (!source) {
      return NextResponse.json({ error: 'OFAC source not found' }, { status: 500 })
    }

    const res = await fetch(OFAC_ACTIONS_URL, {
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

    // /recent-actions/YYYYMMDD 形式のリンクを取得
    $('a[href*="/recent-actions/"]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      if (!/\/recent-actions\/\d{8}/.test(href)) return

      const fullUrl = href.startsWith('http')
        ? href
        : `https://ofac.treasury.gov${href}`

      const title = cleanText($(el).text())
      if (!title || title.length < 5) return

      // URL から日付を抽出（例: /recent-actions/20260327 → 2026-03-27）
      const dateMatch = href.match(/(\d{4})(\d{2})(\d{2})/)
      const published_at = dateMatch
        ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
        : null

      items.push({
        title,
        url: fullUrl,
        content_text: null,
        published_at,
        lang: 'en' as const,
        category: 'sanction' as const,
      })
    })

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
      found: items.length,
      inserted: newItems.length,
      has_more: false, // OFACはページネーション非対応
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
