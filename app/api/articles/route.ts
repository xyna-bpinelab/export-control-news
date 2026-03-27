import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source')
  const category = searchParams.get('category')
  const impact = searchParams.get('impact')
  const q = searchParams.get('q')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = (page - 1) * limit

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('articles')
    .select(
      `*, sources(id, slug, name_ja, country_code), summaries(summary_ja, key_points, impact_level, related_laws)`,
      { count: 'exact' },
    )
    .eq('status', 'summarized')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (source) query = query.eq('sources.slug', source)
  if (category) query = query.eq('category', category)
  if (impact) query = query.eq('summaries.impact_level', impact)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    articles: data,
    total: count ?? 0,
    page,
    limit,
  })
}
