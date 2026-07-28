import type { CheerioAPI } from 'cheerio'
import { BaseScraper, type ScrapedItem } from '@/lib/collectors/scraper'
import { cleanText } from '@/lib/utils/text'

const BASE_URL = 'https://ofac.treasury.gov'

// OFACはRSS配信を2025年1月に廃止したため、recent-actions ページを直接スクレイプする。
// ページネーション非対応で最新分のみ取得できる。
export class OfacScraper extends BaseScraper {
  extract($: CheerioAPI, _baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = []

    $('a[href*="/recent-actions/"]').each((_, el) => {
      const $el = $(el)
      const href = $el.attr('href') ?? ''
      if (!/\/recent-actions\/\d{8}/.test(href)) return

      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`
      const title = cleanText($el.text())
      if (!title || title.length < 5) return

      const dateMatch = href.match(/(\d{4})(\d{2})(\d{2})/)
      const published_at = dateMatch
        ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
        : null

      items.push({
        title,
        url,
        content_text: null,
        published_at,
        lang: 'en',
        category: 'sanction',
      })
    })

    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
  }
}
