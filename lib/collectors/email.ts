import { convert } from 'html-to-text'
import type { CollectedItem } from '@/types'
import { cleanText } from '@/lib/utils/text'

const ALLOWED_DOMAINS = (process.env.INBOUND_EMAIL_ALLOWED_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export interface ParsedEmail {
  from: string
  subject: string
  text: string
  html: string | null
  date: string | null
}

/**
 * 送信元ドメインの許可チェック
 */
export function isAllowedSender(from: string): boolean {
  if (ALLOWED_DOMAINS.length === 0) return true // 未設定の場合は全許可
  const match = from.match(/@([\w.-]+)/)
  const domain = match?.[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.some((allowed) => domain.endsWith(allowed))
}

/**
 * SendGrid Inbound Parse のメールデータを CollectedItem に変換
 */
export function parseInboundEmail(email: ParsedEmail): CollectedItem | null {
  if (!isAllowedSender(email.from)) return null

  const title = email.subject?.trim() || '（件名なし）'

  // HTML メールの場合はプレーンテキストに変換
  let content = email.text?.trim() || ''
  if (!content && email.html) {
    content = convert(email.html, { wordwrap: false })
  }

  if (!content) return null

  // メール本文からURLを抽出（参照先として保存）
  const urlMatch = content.match(/https?:\/\/[^\s\u3000\u300c\u300d]+/)
  const url = urlMatch ? urlMatch[0].replace(/[）)。、,]+$/, '') : null
  if (!url) return null

  const publishedAt = email.date ? new Date(email.date) : null

  return {
    title: cleanText(title),
    url,
    content_text: cleanText(content),
    published_at: publishedAt,
    lang: 'ja',
    category: 'guidance',
  }
}
