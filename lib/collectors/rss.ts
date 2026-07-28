import Parser from 'rss-parser'
import type { CollectedItem, Lang } from '@/types'
import { cleanText } from '@/lib/utils/text'
import { parseFlexibleDate } from '@/lib/utils/date'

const parser = new Parser()

/**
 * RSSフィードを取得してCollectedItemに変換
 *
 * rss-parser の parseURL() は Node の http/https モジュールで直接リクエストするが、
 * Vercel の Node ランタイムからだと一部のサーバー（federalregister.gov 等）に
 * 400 で拒否されることがあるため、fetch() でXMLを取得してから parseString() する。
 */
export async function fetchRssFeed(
  feedUrl: string,
  lang: Lang = 'en',
): Promise<CollectedItem[]> {
  let feed
  try {
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    feed = await parser.parseString(xml)
  } catch (err) {
    throw new Error(`RSS fetch failed for ${feedUrl}: ${err instanceof Error ? err.message : String(err)}`)
  }

  const items: CollectedItem[] = []

  for (const item of feed.items ?? []) {
    const url = item.link ?? item.guid
    if (!url) continue

    const rawContent =
      item['content:encoded'] ??
      item.content ??
      item.contentSnippet ??
      item.summary ??
      ''

    const title = item.title?.trim() ?? '（タイトルなし）'
    const publishedAt = item.pubDate
      ? parseFlexibleDate(item.pubDate)
      : item.isoDate
        ? new Date(item.isoDate)
        : null

    items.push({
      title,
      url,
      content_text: rawContent ? cleanText(rawContent) : null,
      published_at: publishedAt,
      lang,
    })
  }

  return items
}
