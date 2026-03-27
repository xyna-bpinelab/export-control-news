import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/article/ArticleCard'
import type { Article } from '@/types'

export const metadata: Metadata = { title: '記事一覧' }
export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    source?: string
    category?: string
    impact?: string
    q?: string
    page?: string
  }>
}

const ITEMS_PER_PAGE = 20

export default async function ArticlesPage({ searchParams }: Props) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const offset = (page - 1) * ITEMS_PER_PAGE

  const supabase = await createServerSupabaseClient()

  // 機関フィルター: slug → source_id に変換
  let sourceId: string | undefined
  if (params.source) {
    const { data: src } = await supabase
      .from('sources')
      .select('id')
      .eq('slug', params.source)
      .single()
    sourceId = src?.id
  }

  // 重要度フィルターがある場合は summaries を INNER JOIN して絞り込む
  const summaryJoin = params.impact
    ? 'summaries!inner(summary_ja, key_points, impact_level, related_laws)'
    : 'summaries(summary_ja, key_points, impact_level, related_laws)'

  let query = supabase
    .from('articles')
    .select(
      `*, sources(id, slug, name_ja, country_code), ${summaryJoin}`,
      { count: 'exact' },
    )
    .in('status', ['collected', 'summarizing', 'summarized'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (params.category) query = query.eq('category', params.category)
  if (sourceId) query = query.eq('source_id', sourceId)
  if (params.impact) query = query.eq('summaries.impact_level', params.impact)

  const { data, count } = await query
  const articles = (data ?? []) as Article[]
  const totalPages = Math.ceil((count ?? 0) / ITEMS_PER_PAGE)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">記事一覧</h1>

      {/* 検索・フィルタ */}
      <form method="GET" className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="キーワード検索..."
            className="flex-1 min-w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="source"
            defaultValue={params.source ?? ''}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全機関</option>
            <option value="meti">経済産業省</option>
            <option value="mofa">外務省</option>
            <option value="cistec">CISTEC</option>
            <option value="bis">BIS</option>
            <option value="ofac">OFAC</option>
            <option value="eu-commission">欧州委員会</option>
          </select>
          <select
            name="category"
            defaultValue={params.category ?? ''}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全カテゴリ</option>
            <option value="sanction">制裁</option>
            <option value="regulation">規制</option>
            <option value="guidance">ガイダンス</option>
            <option value="alert">アラート</option>
          </select>
          <select
            name="impact"
            defaultValue={params.impact ?? ''}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全重要度</option>
            <option value="high">要対応</option>
            <option value="medium">要確認</option>
            <option value="low">参考情報</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            検索
          </button>
        </div>
      </form>

      {/* 件数表示 */}
      <p className="text-sm text-gray-500 mb-4">
        {count?.toLocaleString() ?? 0}件中 {offset + 1}〜{Math.min(offset + ITEMS_PER_PAGE, count ?? 0)}件を表示
      </p>

      {/* 記事リスト */}
      {articles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          条件に一致する記事がありません。
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/articles?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              前へ
            </a>
          )}
          <span className="px-4 py-2 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/articles?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              次へ
            </a>
          )}
        </div>
      )}
    </div>
  )
}
