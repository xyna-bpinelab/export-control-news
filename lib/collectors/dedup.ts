import type { SupabaseClient } from '@supabase/supabase-js'
import type { CollectedItem } from '@/types'
import { hashUrl, normalizeUrl } from '@/lib/utils/text'

export interface DeduplicatedItem extends CollectedItem {
  url_hash: string
}

/**
 * 既存URLハッシュと照合し、新規のみを返す
 */
export async function deduplicateItems(
  supabase: SupabaseClient,
  items: CollectedItem[],
): Promise<DeduplicatedItem[]> {
  if (items.length === 0) return []

  const normalized = items.map((item) => ({
    ...item,
    url: normalizeUrl(item.url),
    url_hash: hashUrl(normalizeUrl(item.url)),
  }))

  const hashes = normalized.map((item) => item.url_hash)

  // 既存ハッシュをバッチ取得
  const { data: existing } = await supabase
    .from('articles')
    .select('url_hash')
    .in('url_hash', hashes)

  const existingSet = new Set((existing ?? []).map((r: { url_hash: string }) => r.url_hash))

  return normalized.filter((item) => !existingSet.has(item.url_hash))
}
