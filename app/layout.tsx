import type { Metadata } from 'next'
import './globals.css'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? '輸出管理情報ポータル'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://export-control-news.vercel.app'

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description:
    '経済産業省・外務省・BIS・OFAC等の政府機関から輸出管理・安全保障貿易に関する最新情報をAI要約付きで自動収集・掲載します。',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    siteName,
    locale: 'ja_JP',
  },
  alternates: {
    types: {
      'application/rss+xml': `${siteUrl}/feed`,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">輸出管理情報ポータル</span>
              <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Beta
              </span>
            </a>
            <nav className="flex items-center gap-4 text-sm text-gray-600">
              <a href="/articles" className="hover:text-gray-900 transition-colors">
                記事一覧
              </a>
              <a href="/sources" className="hover:text-gray-900 transition-colors">
                収集元機関
              </a>
              <a
                href="/feed"
                className="hover:text-gray-900 transition-colors"
                title="RSSフィード"
              >
                RSS
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-gray-500">
            <p>
              本サイトは政府機関等の公開情報を自動収集・AI要約して掲載しています。
              情報の正確性については各機関の公式発表をご確認ください。
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
