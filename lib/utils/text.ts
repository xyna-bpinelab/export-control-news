import { convert } from 'html-to-text'
import * as crypto from 'crypto'

/**
 * URL の SHA-256 ハッシュを生成（重複排除用）
 */
export function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url.trim().toLowerCase()).digest('hex')
}

/**
 * URL を正規化（末尾スラッシュ・クエリパラム統一等）
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // fragment を除去
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * HTML をプレーンテキストに変換
 */
export function htmlToText(html: string): string {
  return convert(html, {
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
      { selector: 'script', format: 'skip' },
      { selector: 'style', format: 'skip' },
    ],
    wordwrap: false,
  }).trim()
}

/**
 * テキストを指定トークン数に近い文字数に切り詰める
 * 1トークン ≈ 2文字（日本語）として概算
 */
export function truncateForLLM(text: string, maxTokens = 8000): string {
  const maxChars = maxTokens * 2
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '...'
}

/**
 * テキストから不要な空白・制御文字を除去
 */
export function cleanText(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \u3000]+/g, ' ')
    .trim()
}
