import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Article } from '@/types'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://export-control-news.vercel.app'
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? '輸出管理情報ポータル'

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('articles')
    .select('*, sources(name_ja), summaries(summary_ja, impact_level)')
    .eq('status', 'summarized')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50)

  const articles = (data ?? []) as Article[]

  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const items = articles
    .map((article) => {
      const title = escapeXml(article.title_ja ?? article.title)
      const description = escapeXml(article.summaries?.summary_ja ?? '')
      const pubDate = article.published_at
        ? new Date(article.published_at).toUTCString()
        : new Date(article.collected_at).toUTCString()
      const link = escapeXml(`${siteUrl}/articles/${article.id}`)
      const sourceName = escapeXml(article.sources?.name_ja ?? '')

      return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${link}</guid>
      <category>${sourceName}</category>
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}</link>
    <description>政府機関等からの輸出管理・安全保障貿易情報をAI要約付きで配信</description>
    <language>ja</language>
    <atom:link href="${siteUrl}/feed" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
