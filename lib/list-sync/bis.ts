/**
 * BIS Entity List 同期
 * ソース: https://www.bis.doc.gov/dpl/TheEntityList.csv (パイプ区切り)
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const BIS_URL =
  process.env.BIS_ENTITY_LIST_URL ?? 'https://www.bis.doc.gov/dpl/TheEntityList.csv'
const LIST_SOURCE = 'bis_entity_list'
const BATCH_SIZE = 200

interface BisEntry {
  name: string
  country: string
  address: string
  concern_categories: string[]
  notes: string
}

function parsePipeDelimited(text: string): BisEntry[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split('|').map(h => h.trim().toLowerCase())

  const idx = {
    name:    headers.findIndex(h => h === 'name' || h.includes('entity name')),
    country: headers.findIndex(h => h === 'country'),
    address: headers.findIndex(h => h.includes('address') || h === 'city'),
    licReq:  headers.findIndex(h => h.includes('license req')),
    licPol:  headers.findIndex(h => h.includes('license policy')),
  }

  const entries: BisEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|')
    const name = (idx.name >= 0 ? cols[idx.name] : '').trim()
    if (!name) continue

    entries.push({
      name,
      country: (idx.country >= 0 ? cols[idx.country] : '').trim(),
      address: (idx.address >= 0 ? cols[idx.address] : '').trim(),
      concern_categories: idx.licReq >= 0 && cols[idx.licReq]?.trim()
        ? [cols[idx.licReq].trim()]
        : [],
      notes: (idx.licPol >= 0 ? cols[idx.licPol] : '').trim(),
    })
  }
  return entries
}

export async function syncBisEntityList(
  supabase: SupabaseClient,
): Promise<{ inserted: number; total: number; source_url: string }> {
  const res = await fetch(BIS_URL, {
    headers: { 'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)' },
  })
  if (!res.ok) throw new Error(`BIS fetch failed: ${res.status} ${BIS_URL}`)

  const text = await res.text()
  const entries = parsePipeDelimited(text)
  if (entries.length === 0) throw new Error('BIS CSV のパースに失敗しました（0件）')

  // 全件削除 → 再投入（全件更新）
  const { error: delErr } = await supabase
    .from('screening_list_entries')
    .delete()
    .eq('list_source', LIST_SOURCE)
  if (delErr) throw new Error(`BIS delete error: ${delErr.message}`)

  let inserted = 0
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(e => ({
      list_source: LIST_SOURCE,
      name: e.name,
      aliases: [],
      country: e.country || null,
      address: e.address || null,
      concern_categories: e.concern_categories,
      notes: e.notes || null,
      synced_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('screening_list_entries').insert(batch)
    if (error) throw new Error(`BIS insert error: ${error.message}`)
    inserted += batch.length
  }

  return { inserted, total: entries.length, source_url: BIS_URL }
}
