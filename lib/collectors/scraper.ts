import * as cheerio from 'cheerio'
import * as iconv from 'iconv-lite'
import type { CollectedItem } from '@/types'

const MIN_INTERVAL_MS = parseInt(process.env.SCRAPE_MIN_INTERVAL_MS ?? '3000', 10)

let lastRequestTime = 0

async function politeDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

/**
 * HTMLを取得（文字コード自動変換付き）
 */
export async function fetchHtml(url: string): Promise<{ $: cheerio.CheerioAPI; html: string }> {
  await politeDelay()

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.9',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }

  // Content-Type から文字コードを検出
  const contentType = res.headers.get('content-type') ?? ''
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i)
  const charset = charsetMatch?.[1]?.toLowerCase()

  let html: string
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    const buffer = Buffer.from(await res.arrayBuffer())
    html = iconv.decode(buffer, charset)
  } else {
    html = await res.text()
    // meta タグから charset を再検出（Shift-JIS で UTF-8 と宣言している場合等）
    if (html.includes('charset=shift_jis') || html.includes('charset=Shift_JIS')) {
      // 再取得
      const res2 = await fetch(url, { headers: { 'User-Agent': 'ExportControlNewsBot/1.0' } })
      const buf = Buffer.from(await res2.arrayBuffer())
      html = iconv.decode(buf, 'Shift_JIS')
    }
  }

  const $ = cheerio.load(html)
  return { $, html }
}

export type ScrapedItem = CollectedItem

/**
 * スクレイパー基底クラス
 */
export abstract class BaseScraper {
  abstract extract($: cheerio.CheerioAPI, baseUrl: string): ScrapedItem[]

  async scrape(url: string): Promise<ScrapedItem[]> {
    const { $, html } = await fetchHtml(url)
    void html
    return this.extract($, url)
  }
}
