import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deduplicateItems } from '@/lib/collectors/dedup'
import type { CollectedItem } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1/documents.json'
const PER_PAGE = 100

interface FederalRegisterDoc {
  title: string
  html_url: string
  publication_date: string
  abstract?: string
  document_number: string
  type: string
}

interface FederalRegisterResponse {
  count: number
  total_pages: number
  results: FederalRegisterDoc[]
}

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const supabase = createServiceRoleClient()

  // BIS の source_id を取得
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('slug', 'bis')
    .single()

  if (!source) {
    return NextResponse.json({ error: 'BIS source not found' }, { status: 500 })
  }

  // Federal Register API でページ取得（配列パラメータは手動で組み立て）
  const qs = [
    'conditions%5Bagencies%5D%5B%5D=industry-and-security-bureau',
    'conditions%5Btype%5D%5B%5D=Rule',
    'conditions%5Btype%5D%5B%5D=Proposed+Rule',
    'conditions%5Btype%5D%5B%5D=Notice',
    `per_page=${PER_PAGE}`,
    `page=${page}`,
    'order=newest',
    'fields%5B%5D=title',
    'fields%5B%5D=html_url',
    'fields%5B%5D=publication_date',
    'fields%5B%5D=abstract',
    'fields%5B%5D=document_number',
  ].join('&')

  const res = await fetch(`${FEDERAL_REGISTER_API}?${qs}`, {
    headers: { 'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)' },
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Federal Register API error: ${res.status}` }, { status: 500 })
  }

  const data: FederalRegisterResponse = await res.json()

  const items: CollectedItem[] = data.results.map((doc) => ({
    title: doc.title,
    url: doc.html_url,
    content_text: doc.abstract ?? null,
    published_at: doc.publication_date ? new Date(doc.publication_date) : null,
    lang: 'en' as const,
    category: 'regulation' as const,
  }))

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

    const { error } = await supabase.from('articles').insert(rows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    page,
    total_pages: data.total_pages,
    found: items.length,
    inserted: newItems.length,
    has_more: page < data.total_pages,
  })
}
