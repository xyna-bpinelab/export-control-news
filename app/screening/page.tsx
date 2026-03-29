'use client'

import { useState } from 'react'
import type { ScreeningInput, ScreeningResult } from '@/types'

const STATUS_CONFIG = {
  clear: {
    label: '懸念なし',
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  gray: {
    label: '要詳細調査（グレー）',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    icon: '⚠️',
  },
  concern: {
    label: '懸念あり（要許可申請）',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    icon: '🚫',
  },
}

export default function ScreeningPage() {
  const [form, setForm] = useState<ScreeningInput>({
    customer_name: '',
    country: '',
    business_description: '',
    product: '',
  })
  const [result, setResult] = useState<ScreeningResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch('/api/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '判定中にエラーが発生しました。')
      } else {
        setResult(data as ScreeningResult)
      }
    } catch {
      setError('ネットワークエラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  const statusCfg = result ? STATUS_CONFIG[result.status] : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">需要者スクリーニング</h1>
        <p className="text-sm text-gray-500">
          外国ユーザーリスト・エンティティリスト等との照合によるWMD転用リスク判定（外為法キャッチオール規制）
        </p>
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              顧客名 <span className="text-gray-400 font-normal">（略称・英語表記可）</span>
            </label>
            <input
              type="text"
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              placeholder="例: NWPU、北航、ABC Corp."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              所在地 <span className="text-gray-400 font-normal">（国名のみでも可）</span>
            </label>
            <input
              type="text"
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="例: 中国、Iran、Russia"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            輸出予定製品
          </label>
          <input
            type="text"
            name="product"
            value={form.product}
            onChange={handleChange}
            placeholder="例: 精密センサー、半導体製造装置、炭素繊維"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            事業内容 <span className="text-gray-400 font-normal">（不明でも可）</span>
          </label>
          <textarea
            name="business_description"
            value={form.business_description}
            onChange={handleChange}
            rows={2}
            placeholder="例: 大学研究機関、防衛関連企業、民間航空部品メーカー"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || (!form.customer_name && !form.country)}
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'AI判定中...' : '🔎 スクリーニングを実行'}
        </button>
      </form>

      {/* 判定結果 */}
      {result && statusCfg && (
        <div className={`rounded-lg border-2 ${statusCfg.border} ${statusCfg.bg} p-6 space-y-5`}>
          {/* ステータス */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusCfg.icon}</span>
            <div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">判定ステータス</div>
              <div className={`text-lg font-bold ${statusCfg.text}`}>{statusCfg.label}</div>
            </div>
          </div>

          {/* 該当・類似組織 */}
          {result.matched_organizations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">該当・類似組織の情報</h3>
              <div className="space-y-2">
                {result.matched_organizations.map((org, i) => (
                  <div key={i} className="bg-white rounded-md border border-gray-200 px-4 py-3 text-sm space-y-1.5">
                    <div className="font-medium text-gray-900">{org.name_on_list}</div>
                    {org.list_name && (
                      <div className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block">
                        {org.list_name}
                      </div>
                    )}
                    {org.location && <div className="text-gray-500">所在地: {org.location}</div>}
                    {org.concern_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {org.concern_categories.map((cat, j) => (
                          <span key={j} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    {org.similarity_reason && (
                      <div className="text-xs text-gray-500 border-t border-gray-100 pt-1.5">
                        類似理由: {org.similarity_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* チェック済みリスト */}
          {result.checked_lists.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">照合リスト一覧</h3>
              <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
                {result.checked_lists.map((list, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{list.name}</span>
                    {list.result === 'no_match' && (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">一致なし</span>
                    )}
                    {list.result === 'similar' && (
                      <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">類似あり</span>
                    )}
                    {list.result === 'match' && (
                      <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">該当あり</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 判定の根拠 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">判定の根拠</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
          </div>

          {/* 不足情報によるリスク */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">不足情報によるリスク</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{result.missing_info_risks}</p>
          </div>

          {/* 次に行うべきアクション */}
          {result.next_actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">次に行うべきアクション</h3>
              <ul className="space-y-1">
                {result.next_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-gray-400 mt-0.5 shrink-0">▶</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 免責事項 */}
          <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 leading-relaxed">
            本判定はAIによる参考情報であり、法的判断を構成するものではありません。
            最終的な輸出可否の判断は、関連法令および経済産業省の公式見解に基づき、自社の責任において行ってください。
          </div>
        </div>
      )}
    </div>
  )
}
