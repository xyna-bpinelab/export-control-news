import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/article/ArticleCard'
import type { Article } from '@/types'

export const revalidate = 3600

async function getTopArticles(): Promise<Article[]> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('articles')
    .select('*, sources(id, slug, name_ja, country_code), summaries(summary_ja, key_points, impact_level, related_laws)')
    .in('status', ['collected', 'summarizing', 'summarized'])
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(5)

  return (data ?? []) as Article[]
}


const FEATURES = [
  {
    href: '/classification',
    icon: '🔍',
    title: '該非判定',
    description: '品名・仕様を入力し、外為法（別表第1）および米国EAR（ECCN）の規制対象品目に該当するか判定します。',
    badge: null,
    color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
    labelColor: 'text-blue-600',
  },
  {
    href: '/license',
    icon: '📋',
    title: '輸出許可判断',
    description: '該非判定結果に仕向地・最終用途・需要者を加え、輸出許可申請が必要かどうかを判断します。',
    badge: null,
    color: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50',
    labelColor: 'text-purple-600',
  },
  {
    href: '/screening',
    icon: '🛡️',
    title: '需要者スクリーニング',
    description: '顧客名・所在地をもとに、外国ユーザーリスト・BIS・OFAC等の懸念リストとの照合を行います。',
    badge: null,
    color: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50',
    labelColor: 'text-orange-600',
  },
  {
    href: '/articles',
    icon: '📰',
    title: '記事一覧',
    description: '経産省・外務省・BIS・OFAC等の政府機関から輸出管理の最新情報をAI要約付きで自動収集します。',
    badge: '自動更新',
    color: 'border-green-200 hover:border-green-400 hover:bg-green-50',
    labelColor: 'text-green-600',
  },
]

export default async function HomePage() {
  const articles = await getTopArticles()

  return (
    <div className="space-y-10">
      {/* ヒーロー */}
      <div>
        <p className="text-gray-500 text-sm">
          安全保障貿易管理（外為法・EAR）をAIでサポートします。該非判定から需要者スクリーニングまで、輸出コンプライアンス業務を効率化します。
        </p>
      </div>

      {/* 機能カード */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-4">機能メニュー</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <a
              key={f.href}
              href={f.href}
              className={`group bg-white border rounded-xl p-5 transition-all duration-150 ${f.color}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{f.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-base ${f.labelColor}`}>{f.title}</span>
                      {f.badge && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                          {f.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-lg shrink-0">→</span>
              </div>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed">{f.description}</p>
            </a>
          ))}
        </div>
      </div>

      {/* 最新情報 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-700">最新情報</h2>
          <a href="/articles" className="text-sm text-blue-600 hover:underline">
            すべて見る →
          </a>
        </div>
        {articles.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400 text-sm">
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
    </div>
  )
}
