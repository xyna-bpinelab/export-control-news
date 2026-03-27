import Parser from 'rss-parser'
import type { CollectedItem, Lang } from '@/types'
import { cleanText } from '@/lib/utils/text'
import { parseFlexibleDate } from '@/lib/utils/date'

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  },
})

/**
 * RSSフィードを取得してCollectedItemに変換
 */
export async function fetchRssFeed(
  feedUrl: string,
  lang: Lang = 'en',
): Promise<CollectedItem[]> {
  let feed
  try {
    feed = await parser.parseURL(feedUrl)
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
