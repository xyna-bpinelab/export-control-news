import type { CheerioAPI } from 'cheerio'
import { BaseScraper, type ScrapedItem } from '@/lib/collectors/scraper'
import { parseFlexibleDate } from '@/lib/utils/date'
import { cleanText } from '@/lib/utils/text'

const BASE_URL = 'https://www.mofa.go.jp'

export class MofaScraper extends BaseScraper {
  extract($: CheerioAPI, _baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = []

    // 外務省の制裁情報ページ構造に合わせたセレクタ
    $('table tr, .news-list li, ul.list li').each((_, el) => {
      const $el = $(el)
      const $link = $el.find('a').first()
      const href = $link.attr('href')
      if (!href) return

      const url = href.startsWith('http')
        ? href
        : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`

      const title = cleanText($link.text())
      if (!title || title.length < 5) return

      // 制裁・資産凍結に関するページのみ収集
      const isRelevant =
        url.includes('huzai') ||
        url.includes('sanction') ||
        url.includes('gaiko') ||
        title.includes('制裁') ||
        title.includes('資産凍結') ||
        title.includes('輸出') ||
        title.includes('武器')

      if (!isRelevant) return

      const dateText = $el.find('.date, time').first().text() || ''
      const published_at = dateText ? parseFlexibleDate(dateText) : null

      items.push({
        title,
        url,
        content_text: null,
        published_at,
        lang: 'ja',
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
