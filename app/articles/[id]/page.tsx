import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDateJST } from '@/lib/utils/date'
import type { Article } from '@/types'

export const revalidate = 3600

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('articles')
    .select('title, title_ja, summaries(summary_ja)')
    .eq('id', id)
    .single()

  if (!data) return {}

  const title = (data as Article).title_ja ?? (data as Article).title
  const description = (data as Article).summaries?.summary_ja?.slice(0, 160)

  return { title, description }
}

const IMPACT_CONFIG = {
  high: { label: '要対応', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '要確認', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: '参考情報', className: 'bg-blue-100 text-blue-700 border-blue-200' },
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      sources(id, slug, name_ja, name_en, country_code, base_url),
      summaries(summary_ja, key_points, impact_level, related_laws, created_at, model_used)
    `)
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const article = data as Article
  const summary = article.summaries
  const source = article.sources
  const displayTitle = article.title_ja ?? article.title
  const impactConfig = summary?.impact_level ? IMPACT_CONFIG[summary.impact_level] : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <a href="/articles" className="text-sm text-blue-600 hover:underline">
          ← 記事一覧に戻る
        </a>
      </div>

      <article className="bg-white rounded-lg border border-gray-200 p-6 lg:p-8">
        {/* メタ情報 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {source && (
            <span className="text-sm text-gray-500">
              {source.name_ja}
            </span>
          )}
          {impactConfig && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${impactConfig.className}`}>
              {impactConfig.label}
            </span>
          )}
          <span className="ml-auto text-sm text-gray-400">
            {formatDateJST(article.published_at ?? article.collected_at)}
          </span>
        </div>

        {/* タイトル */}
        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">
          {displayTitle}
        </h1>
        {article.title_ja && article.lang === 'en' && (
          <p className="text-sm text-gray-400 mb-4">原題: {article.title}</p>
        )}

        {/* 原文リンク */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          原文を読む（{source?.name_en ?? source?.name_ja}）
        </a>

        {summary ? (
          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-gray-900">AI要約</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {summary.model_used}
              </span>
            </div>

            {/* 要約本文 */}
            <p className="text-gray-700 leading-relaxed mb-5">{summary.summary_ja}</p>

            {/* ポイント */}
            {summary.key_points && summary.key_points.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">重要ポイント</h3>
                <ul className="space-y-1.5">
                  {summary.key_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 関連法令 */}
            {summary.related_laws && summary.related_laws.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">関連法令・規制</h3>
                <div className="flex flex-wrap gap-2">
                  {summary.related_laws.map((law, i) => (
                    <span
                      key={i}
                      className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full"
                    >
                      {law}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400">
              本要約はAIにより自動生成されたものです。情報の正確性については原文をご確認ください。
            </p>
          </div>
        ) : (
          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-400">要約を準備中です...</p>
          </div>
        )}
      </article>
    </div>
  )
}
