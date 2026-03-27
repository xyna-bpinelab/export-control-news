// 和暦テーブル（開始年: 西暦）
const GENGO: Record<string, number> = {
  令和: 2019,
  平成: 1989,
  昭和: 1926,
  大正: 1912,
  明治: 1868,
}

/**
 * 和暦文字列を Date に変換
 * 例: "令和6年3月15日" → Date(2024-03-15)
 */
export function parseJapaneseDate(text: string): Date | null {
  for (const [gengo, baseYear] of Object.entries(GENGO)) {
    const match = text.match(
      new RegExp(`${gengo}(\\d+|元)年(\\d+)月(\\d+)日`),
    )
    if (match) {
      const year = match[1] === '元' ? baseYear : baseYear + parseInt(match[1]) - 1
      const month = parseInt(match[2]) - 1
      const day = parseInt(match[3])
      return new Date(year, month, day)
    }
  }
  return null
}

/**
 * 多様な形式の日付文字列を Date に変換
 */
export function parseFlexibleDate(text: string): Date | null {
  if (!text) return null

  // 和暦
  const jpDate = parseJapaneseDate(text)
  if (jpDate) return jpDate

  // ISO 8601 / RFC 2822 等は Date() に任せる
  const parsed = new Date(text)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * JST での相対時間表示（例: "3時間前", "2日前"）
 */
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '日時不明'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  if (diffHour < 24) return `${diffHour}時間前`
  if (diffDay < 7) return `${diffDay}日前`
  return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * JST での日付文字列（例: "2024年3月15日"）
 */
export function formatDateJST(dateStr: string | null): string {
  if (!dateStr) return '日時不明'
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
