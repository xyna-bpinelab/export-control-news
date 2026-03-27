import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { collectFromSource } from '@/lib/collectors'
import type { Source } from '@/types'

export const maxDuration = 60 // Vercel Pro: 60秒
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const start = Date.now()

  // アクティブな収集元を取得
  const { data: sources, error } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .in('collector_type', ['rss', 'scraper'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 並列収集（最大3並列でタイムアウト対策）
  const results = await Promise.allSettled(
    (sources as Source[]).map((source) => collectFromSource(supabase, source)),
  )

  const summary = results.map((r, i) => {
    const source = (sources as Source[])[i]
    if (r.status === 'fulfilled') return r.value
    return { sourceId: source.id, slug: source.slug, found: 0, inserted: 0, error: r.reason?.message }
  })

  const totalInserted = summary.reduce((sum, r) => sum + r.inserted, 0)
  const totalFound = summary.reduce((sum, r) => sum + r.found, 0)

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - start,
    total_found: totalFound,
    total_inserted: totalInserted,
    sources: summary,
  })
}
