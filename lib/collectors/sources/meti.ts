import type { CheerioAPI } from 'cheerio'
import { BaseScraper, type ScrapedItem } from '@/lib/collectors/scraper'
import { parseFlexibleDate } from '@/lib/utils/date'
import { cleanText } from '@/lib/utils/text'

const BASE_URL = 'https://www.meti.go.jp'

export class MetiScraper extends BaseScraper {
  extract($: CheerioAPI, baseUrl: string): ScrapedItem[] {
    const items: ScrapedItem[] = []

    // 安全保障貿易管理ページの「最新情報」テーブルと新着リスト
    // セレクタは実際のページ構造に合わせて調整が必要
    const selectors = [
      '.news-list li',
      '.update-list li',
      'table.news-table tr',
      '.anpo-news li',
    ]

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el)
        const $link = $el.find('a').first()
        const href = $link.attr('href')
        if (!href) return

        const url = href.startsWith('http')
          ? href
          : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`

        const title = cleanText($link.text() || $el.text())
        if (!title || title.length < 5) return

        // 日付テキストを抽出（"令和X年X月X日" or "YYYY.MM.DD" 等）
        const dateText = $el.find('.date, .day, time').first().text()
          || $el.text().replace(title, '').trim()
        const published_at = parseFlexibleDate(dateText)

        items.push({
          title,
          url,
          content_text: null, // 詳細ページは取得しない（URLのみ記録）
          published_at,
          lang: 'ja',
          category: 'regulation',
        })
      })
      if (items.length > 0) break // 最初にヒットしたセレクタの結果を使用
    }

    // フォールバック: 全リンクから輸出管理関連を抽出
    if (items.length === 0) {
      $('a').each((_, el) => {
        const $el = $(el)
        const href = $el.attr('href') ?? ''
        const text = cleanText($el.text())

        if (text.length < 5) return
        if (!href.includes('anpo') && !href.includes('export') && !href.includes('安全')) return

        const url = href.startsWith('http')
          ? href
          : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`

        items.push({
          title: text,
          url,
          content_text: null,
          published_at: null,
          lang: 'ja',
          category: 'regulation',
        })
      })
    }

    // 重複除去（URL単位）
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
  }
}
