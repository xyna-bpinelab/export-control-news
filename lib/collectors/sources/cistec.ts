import type { CheerioAPI } from 'cheerio'
import { BaseScraper, type ScrapedItem } from '@/lib/collectors/scraper'
import { parseFlexibleDate } from '@/lib/utils/date'
import { cleanText } from '@/lib/utils/text'

const BASE_URL = 'https://www.cistec.or.jp'

// トップページの「What's New」テーブル（tr.tableWhatNew、日付は YY/MM/DD）を解析する。
// 旧 export_information ページは廃止されたため、トップページを対象とする。
function parseCistecDate(text: string): Date | null {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!m) return parseFlexibleDate(text)
  const [, yy, mm, dd] = m
  return new Date(`20${yy}-${mm}-${dd}`)
}

export class CistecScraper extends BaseScraper {
  extract($: CheerioAPI, _baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = []

    $('tr.tableWhatNew').each((_, el) => {
      const $tds = $(el).find('td')
      const $link = $tds.eq(1).find('a').first()
      const href = $link.attr('href')
      if (!href) return

      const url = href.startsWith('http')
        ? href
        : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`

      const title = cleanText($link.text())
      if (!title || title.length < 5) return

      const published_at = parseCistecDate($tds.eq(0).text())

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
