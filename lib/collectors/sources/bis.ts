import type { CollectedItem } from '@/types'

// federalregister.gov の RSS エンドポイント（/documents.rss）は Vercel の Node
// ランタイムからのリクエストを一貫して 400 で拒否する（JSON API は問題なし）。
// 原因不明だがRSS固有の挙動のため、JSON API（バックフィルと同じ）で代替する。
const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1/documents.json'

interface FederalRegisterDoc {
  title: string
  html_url: string
  publication_date: string
  abstract?: string
}

interface FederalRegisterResponse {
  results: FederalRegisterDoc[]
}

export class BisScraper {
  async scrape(_url: string): Promise<CollectedItem[]> {
    const qs = [
      'conditions%5Bagencies%5D%5B%5D=industry-and-security-bureau',
      'per_page=50',
      'page=1',
      'order=newest',
      'fields%5B%5D=title',
      'fields%5B%5D=html_url',
      'fields%5B%5D=publication_date',
      'fields%5B%5D=abstract',
    ].join('&')

    const res = await fetch(`${FEDERAL_REGISTER_API}?${qs}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status} for Federal Register API`)

    const data: FederalRegisterResponse = await res.json()

    return data.results.map((doc) => ({
      title: doc.title,
      url: doc.html_url,
      content_text: doc.abstract ?? null,
      published_at: doc.publication_date ? new Date(doc.publication_date) : null,
      lang: 'en' as const,
      category: 'regulation' as const,
    }))
  }
}
