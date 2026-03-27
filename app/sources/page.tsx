import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Source } from '@/types'

export const metadata: Metadata = { title: '収集元機関一覧' }
export const revalidate = 3600

const COUNTRY_FLAG: Record<string, string> = { JP: '🇯🇵', US: '🇺🇸', EU: '🇪🇺' }
const COLLECTOR_LABEL: Record<string, string> = { rss: 'RSS', scraper: 'スクレイピング', email: 'メール' }

export default async function SourcesPage() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('sources')
    .select('*')
    .eq('is_active', true)
    .order('country_code')

  const sources = (data ?? []) as Source[]

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">収集元機関一覧</h1>
      <p className="text-sm text-gray-500 mb-6">
        以下の機関から輸出管理に関する情報を自動収集しています。
      </p>

      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span>{COUNTRY_FLAG[source.country_code] ?? ''}</span>
                  <span className="font-semibold text-gray-900">{source.name_ja}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                    {COLLECTOR_LABEL[source.collector_type]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{source.name_en}</p>
              </div>
              <a
                href={source.base_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline shrink-0"
              >
                公式サイト →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
