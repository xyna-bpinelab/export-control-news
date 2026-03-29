'use client'

import { useState } from 'react'
import type { ClassificationInput, ClassificationResult } from '@/types'

const STATUS_CONFIG = {
  controlled: {
    label: '規制対象',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-600 text-white',
    icon: '⛔',
  },
  gray: {
    label: '要詳細確認',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    badge: 'bg-yellow-500 text-white',
    icon: '⚠️',
  },
  clear: {
    label: '規制対象外（EAR99）',
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-600 text-white',
    icon: '✅',
  },
}

export default function ClassificationPage() {
  const [form, setForm] = useState<ClassificationInput>({
    product_name: '',
    description: '',
    specs: '',
  })
  const [result, setResult] = useState<ClassificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const cfg = result ? STATUS_CONFIG[result.status] : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">該非判定</h1>
        <p className="text-sm text-gray-600">
          製品・技術が輸出規制品目に該当するか判定します。日本の外為法（輸出令別表第1）および米国EAR（CCL/ECCN）に基づきAIが判定します。
          仕向地・最終用途は問いません。スペックを詳しく入力するほど精度が向上します。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            品名・型番 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="例: 周波数シンセサイザー Model XYZ-100"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.product_name}
            onChange={e => setForm({ ...form, product_name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            用途・機能説明
            <span className="ml-1 text-xs text-gray-400 font-normal">（入力推奨）</span>
          </label>
          <textarea
            rows={3}
            placeholder="例: 無線通信システムの周波数生成に使用するRF信号源。基地局テスト装置に組み込む予定。"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            主要仕様・パラメータ
            <span className="ml-1 text-xs text-gray-400 font-normal">（入力推奨）</span>
          </label>
          <textarea
            rows={3}
            placeholder="例: 周波数範囲: 100MHz〜40GHz、出力: +20dBm、位相雑音: -130dBc/Hz@1kHz"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.specs}
            onChange={e => setForm({ ...form, specs: e.target.value })}
          />
          <p className="mt-1 text-xs text-gray-400">
            周波数・出力・精度・サンプリングレート等、規制閾値に関わるパラメータを入力してください
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 px-4 rounded-md text-sm transition-colors"
        >
          {loading ? '判定中...' : '該非判定を実行'}
        </button>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && cfg && (
        <div className="space-y-4">
          {/* 総合判定 */}
          <div className={`border rounded-lg p-5 ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{cfg.icon}</span>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
            <p className={`text-sm ${cfg.text} leading-relaxed`}>{result.overall_assessment}</p>
          </div>

          {/* 外為法 */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🇯🇵</span> 外為法（輸出令別表第1 リスト規制）
            </h2>
            <div className="mb-3">
              <span className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${result.japan_fefta.list_controlled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                リスト規制: {result.japan_fefta.list_controlled ? '該当' : '非該当'}
              </span>
            </div>

            {result.japan_fefta.relevant_items.length > 0 && (
              <div className="mb-3 space-y-2">
                {result.japan_fefta.relevant_items.map((item, i) => (
                  <div key={i} className={`border rounded-md p-3 text-xs ${item.applicable ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold ${item.applicable ? 'text-red-700' : 'text-gray-600'}`}>
                        {item.applicable ? '◆ ' : '◇ '}{item.item_number}
                      </span>
                      <span className="text-gray-500">{item.category}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded font-medium ${item.applicable ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.applicable ? '該当可能性あり' : '非該当'}
                      </span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
              {result.japan_fefta.reasoning}
            </p>
          </div>

          {/* EAR */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🇺🇸</span> 米国EAR（Commerce Control List）
            </h2>
            <div className="flex flex-wrap gap-3 mb-3">
              <span className="px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                ECCN: <strong>{result.us_ear.eccn}</strong>
              </span>
              {result.us_ear.applicable_reasons.length > 0 && (
                <span className="px-2 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
                  規制理由: {result.us_ear.applicable_reasons.join(', ')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{result.us_ear.reasoning}</p>
          </div>

          {/* 残リスク */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="font-semibold text-amber-800 mb-2 text-sm">⚠️ 情報不足による残リスク</h2>
            <p className="text-xs text-amber-700 leading-relaxed">{result.missing_info_risks}</p>
          </div>

          {/* 次のアクション */}
          {result.next_actions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="font-semibold text-blue-800 mb-2 text-sm">次に取るべきアクション</h2>
              <ol className="space-y-1">
                {result.next_actions.map((action, i) => (
                  <li key={i} className="text-xs text-blue-700 flex gap-2">
                    <span className="font-bold shrink-0">{i + 1}.</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 許可判断へのリンク */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">次のステップ：輸出許可判断</p>
              <p className="text-xs text-gray-500 mt-0.5">この該非判定結果をもとに、仕向地・用途を加えた許可判断を実行できます</p>
            </div>
            <a
              href={`/license?eccn=${encodeURIComponent(result.us_ear.eccn)}&fefta=${encodeURIComponent(
                result.japan_fefta.relevant_items.filter(i => i.applicable).map(i => i.item_number).join(', ') || '非該当'
              )}`}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              許可判断へ →
            </a>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            ※ 本判定はAIによる参考情報です。最終的な該非判定は輸出者の責任において行ってください。
            重要案件については、経済産業省またはメーカーの安全保障貿易担当部署へご相談ください。
          </p>
        </div>
      )}
    </div>
  )
}
