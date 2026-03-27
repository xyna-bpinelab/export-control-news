import type { CheerioAPI } from 'cheerio'
import { BaseScraper, type ScrapedItem } from '@/lib/collectors/scraper'
import { parseFlexibleDate } from '@/lib/utils/date'
import { cleanText } from '@/lib/utils/text'

const BASE_URL = 'https://www.cistec.or.jp'

export class CistecScraper extends BaseScraper {
  extract($: CheerioAPI, _baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = []

    $('ul li, dl dd, .news-item').each((_, el) => {
      const $el = $(el)
      const $link = $el.find('a').first()
      const href = $link.attr('href')
      if (!href) return

      const url = href.startsWith('http')
        ? href
        : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`

      const title = cleanText($link.text())
      if (!title || title.length < 5) return

      const dateText = $el.find('.date, time').first().text()
        || $el.text().slice(0, 20)
      const published_at = parseFlexibleDate(dateText)

      items.push({
        title,
        url,
        content_text: null,
        published_at,
        lang: 'ja',
        category: 'guidance',
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
