import type { Article } from '@/types'
import { formatRelativeTime } from '@/lib/utils/date'

const COUNTRY_FLAG: Record<string, string> = {
  JP: '🇯🇵',
  US: '🇺🇸',
  EU: '🇪🇺',
}

const IMPACT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: '要対応' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '要確認' },
  low: { bg: 'bg-blue-100', text: 'text-blue-700', label: '参考情報' },
}

const CATEGORY_LABEL: Record<string, string> = {
  sanction: '制裁',
  regulation: '規制',
  guidance: 'ガイダンス',
  alert: 'アラート',
  other: 'その他',
}

interface Props {
  article: Article
}

export function ArticleCard({ article }: Props) {
  const source = article.sources
  const summary = article.summaries
  const displayTitle = article.title_ja ?? article.title
  const impact = summary?.impact_level
  const impactStyle = impact ? IMPACT_STYLES[impact] : null
  const flag = source ? (COUNTRY_FLAG[source.country_code] ?? '') : ''

  return (
    <article className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {source && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium">
            <span>{flag}</span>
            <span>{source.name_ja}</span>
          </span>
        )}
        {article.category && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {CATEGORY_LABEL[article.category] ?? article.category}
          </span>
        )}
        {impactStyle && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded ${impactStyle.bg} ${impactStyle.text}`}
          >
            {impactStyle.label}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {formatRelativeTime(article.published_at ?? article.collected_at)}
        </span>
      </div>

      {/* タイトル */}
      <h2 className="text-base font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
        <a href={`/articles/${article.id}`} className="hover:text-blue-600 transition-colors">
          {displayTitle}
        </a>
      </h2>

      {/* AI要約プレビュー */}
      {summary?.summary_ja && (
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">
          {summary.summary_ja}
        </p>
      )}

      {/* フッター */}
      <div className="flex items-center justify-between">
        {summary?.key_points && summary.key_points.length > 0 && (
          <span className="text-xs text-gray-400">
            ポイント {summary.key_points.length}件
          </span>
        )}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          原文を読む
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </article>
  )
}
