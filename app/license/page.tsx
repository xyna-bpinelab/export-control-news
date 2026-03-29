'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { LicenseInput, LicenseResult } from '@/types'

const STATUS_CONFIG = {
  permit_required: {
    label: '輸出許可申請が必要',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    badge: 'bg-red-600 text-white',
    icon: '⛔',
  },
  exception_applicable: {
    label: '例外規定の適用可能性あり（要確認）',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    badge: 'bg-orange-500 text-white',
    icon: '⚠️',
  },
  no_permit_required: {
    label: '許可申請不要',
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-600 text-white',
    icon: '✅',
  },
  prohibited: {
    label: '輸出禁止',
    bg: 'bg-red-50',
    border: 'border-red-600',
    text: 'text-red-900',
    badge: 'bg-red-800 text-white',
    icon: '🚫',
  },
  gray: {
    label: '判断不能（情報不足）',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    badge: 'bg-yellow-500 text-white',
    icon: '❓',
  },
}

const END_USER_TYPES = [
  '（未選択）',
  '民間企業',
  '政府機関（非軍事）',
  '軍・防衛機関',
  '研究機関・大学',
  '個人',
  'その他',
]

function LicensePage() {
  const searchParams = useSearchParams()
  const [form, setForm] = useState<LicenseInput>({
    has_us_content: true,
    eccn: '',
    japan_fefta_item: '',
    destination_country: '',
    end_use: '',
    end_user_type: '',
    transaction_value: '',
  })
  const [result, setResult] = useState<LicenseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 該非判定からの引き継ぎ
  useEffect(() => {
    const eccn = searchParams.get('eccn')
    const fefta = searchParams.get('fefta')
    if (eccn || fefta) {
      setForm(prev => ({
        ...prev,
        eccn: eccn ?? prev.eccn,
        japan_fefta_item: fefta ?? prev.japan_fefta_item,
      }))
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/license', {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">輸出許可判断</h1>
        <p className="text-sm text-gray-600">
          特定の取引に対して輸出許可申請が必要かどうかを判断します。
          該非判定で取得したECCN・外為法分類に加え、仕向地・最終用途・需要者を入力してください。
        </p>
        {!searchParams.get('eccn') && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
            💡 先に
            <a href="/classification" className="underline font-medium mx-1">該非判定</a>
            を実施してECCN・外為法分類を確認してから入力すると精度が向上します。
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 mb-6 space-y-5">

        {/* 米国成分の有無 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">米国成分（EAR対象）</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="has_us_content"
                checked={form.has_us_content}
                onChange={() => setForm({ ...form, has_us_content: true })}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">あり（米国原産の部品・技術を含む）</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="has_us_content"
                checked={!form.has_us_content}
                onChange={() => setForm({ ...form, has_us_content: false, eccn: '' })}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">なし（EAR非対象）</span>
            </label>
          </div>
        </div>

        {/* 製品分類（該非判定からの引き継ぎ） */}
        <div className="border border-gray-100 rounded-md p-4 bg-gray-50 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">製品分類（該非判定結果）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.has_us_content && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ECCN
                </label>
                <input
                  type="text"
                  placeholder="例: 5A002.a.1 / EAR99"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={form.eccn}
                  onChange={e => setForm({ ...form, eccn: e.target.value })}
                />
              </div>
            )}
            <div className={form.has_us_content ? '' : 'sm:col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                外為法 該当項目
              </label>
              <input
                type="text"
                placeholder="例: 別表第1 第9項 / 非該当"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.japan_fefta_item}
                onChange={e => setForm({ ...form, japan_fefta_item: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* 取引情報 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            仕向地国 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="例: 中国、アラブ首長国連邦、インド、ロシア"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.destination_country}
            onChange={e => setForm({ ...form, destination_country: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            最終用途
            <span className="ml-1 text-xs text-gray-400 font-normal">（入力推奨）</span>
          </label>
          <input
            type="text"
            placeholder="例: 民間基地局の通信試験、大学における航法研究、工場の生産管理システム"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.end_use}
            onChange={e => setForm({ ...form, end_use: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              需要者の種別
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={form.end_user_type}
              onChange={e => setForm({ ...form, end_user_type: e.target.value })}
            >
              {END_USER_TYPES.map(t => (
                <option key={t} value={t === '（未選択）' ? '' : t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              取引金額（概算）
              <span className="ml-1 text-xs text-gray-400 font-normal">少額特例確認用</span>
            </label>
            <input
              type="text"
              placeholder="例: 50万円、10,000 USD"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.transaction_value}
              onChange={e => setForm({ ...form, transaction_value: e.target.value })}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 px-4 rounded-md text-sm transition-colors"
        >
          {loading ? '判断中...' : '許可判断を実行'}
        </button>
      </form>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && cfg && (
        <div className="space-y-4">
          {/* 総合判断 */}
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
              <span>🇯🇵</span> 外為法 許可判断
            </h2>
            <div className="flex flex-wrap gap-2 mb-3 text-sm">
              <span className={`px-2 py-1 rounded-full font-medium ${result.japan_license.permit_required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                輸出許可: {result.japan_license.permit_required ? '必要' : '不要'}
              </span>
              {result.japan_license.country_group && (
                <span className="px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                  仕向地: {result.japan_license.country_group}
                </span>
              )}
            </div>
            {result.japan_license.applicable_exceptions.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs font-medium text-blue-700 mb-1">適用可能な例外・簡易手続き</p>
                <ul className="space-y-0.5">
                  {result.japan_license.applicable_exceptions.map((ex, i) => (
                    <li key={i} className="text-xs text-blue-600">・{ex}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
              {result.japan_license.reasoning}
            </p>
          </div>

          {/* EAR */}
          {result.us_ear_license.country_group === 'N/A' ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 flex items-center gap-2">
              <span>🇺🇸</span>
              <span>米国成分なし — EARの適用対象外です。</span>
            </div>
          ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🇺🇸</span> 米国EAR ライセンス判断
            </h2>
            <div className="flex flex-wrap gap-2 mb-3 text-sm">
              <span className={`px-2 py-1 rounded-full font-medium ${result.us_ear_license.license_required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                ライセンス: {result.us_ear_license.license_required ? '必要' : '不要（NLR）'}
              </span>
              {result.us_ear_license.country_group && (
                <span className="px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                  {result.us_ear_license.country_group}
                </span>
              )}
            </div>
            {result.us_ear_license.applicable_exceptions.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-xs font-medium text-blue-700 mb-1">適用可能なライセンス例外</p>
                <ul className="space-y-0.5">
                  {result.us_ear_license.applicable_exceptions.map((ex, i) => (
                    <li key={i} className="text-xs text-blue-600">・{ex}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
              {result.us_ear_license.reasoning}
            </p>
          </div>
          )}

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

          <p className="text-xs text-gray-400 leading-relaxed">
            ※ 本判断はAIによる参考情報です。最終的な許可判断は輸出者の責任において行ってください。
            重要案件については、経済産業省安全保障貿易管理課または専門家にご相談ください。
          </p>
        </div>
      )}
    </div>
  )
}

export default function LicensePageWrapper() {
  return (
    <Suspense>
      <LicensePage />
    </Suspense>
  )
}
