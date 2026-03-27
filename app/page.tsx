import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/article/ArticleCard'
import type { Article } from '@/types'

export const revalidate = 3600

async function getTopArticles(): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('articles')
    .select('*, sources(id, slug, name_ja, country_code), summaries(summary_ja, key_points, impact_level, related_laws)')
    .eq('status', 'summarized')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(20)

  return (data ?? []) as Article[]
}

async function getStats() {
  const supabase = await createServerSupabaseClient()
  const { count: total } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  const { count: highImpact } = await supabase
    .from('summaries')
    .select('*', { count: 'exact', head: true })
    .eq('impact_level', 'high')

  return { total: total ?? 0, highImpact: highImpact ?? 0 }
}

export default async function HomePage() {
  const [articles, stats] = await Promise.all([getTopArticles(), getStats()])

  return (
    <div>
      {/* ヒーローセクション */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">輸出管理情報ポータル</h1>
        <p className="text-gray-500 text-sm">
          経済産業省・外務省・BIS・OFAC等の政府機関から最新の輸出管理情報をAI要約付きで自動収集します。
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
            <div className="text-gray-500 text-xs mt-1">収集記事数</div>
          </div>
          <div className="bg-white rounded-lg border border-red-200 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.highImpact.toLocaleString()}</div>
            <div className="text-gray-500 text-xs mt-1">要対応情報</div>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* メインコンテンツ */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">最新情報</h2>
            <a href="/articles" className="text-sm text-blue-600 hover:underline">
              すべて見る →
            </a>
          </div>

          {articles.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
              まだ記事がありません。収集が完了するまでお待ちください。
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>

        {/* サイドバー */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">収集元機関</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                { flag: '🇯🇵', name: '経済産業省', slug: 'meti' },
                { flag: '🇯🇵', name: '外務省', slug: 'mofa' },
                { flag: '🇯🇵', name: 'CISTEC', slug: 'cistec' },
                { flag: '🇺🇸', name: 'BIS', slug: 'bis' },
                { flag: '🇺🇸', name: 'OFAC', slug: 'ofac' },
                { flag: '🇪🇺', name: '欧州委員会', slug: 'eu-commission' },
              ].map((s) => (
                <li key={s.slug}>
                  <a
                    href={`/articles?source=${s.slug}`}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    <span>{s.flag}</span>
                    <span>{s.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">カテゴリ</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                { label: '制裁', value: 'sanction' },
                { label: '規制', value: 'regulation' },
                { label: 'ガイダンス', value: 'guidance' },
                { label: 'アラート', value: 'alert' },
              ].map((c) => (
                <li key={c.value}>
                  <a
                    href={`/articles?category=${c.value}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
