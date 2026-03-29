/**
 * 経済産業省 外国ユーザーリスト同期
 * METIページからExcelファイルを自動検出してダウンロード・パース
 */
import * as cheerio from 'cheerio'
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

const METI_PAGE_URL =
  process.env.METI_FUL_PAGE_URL ??
  'https://www.meti.go.jp/policy/anpo/law_document/tutatu/t07sonota/'
const LIST_SOURCE = 'foreign_user_list'
const BATCH_SIZE = 200

const CONCERN_MAP: Record<string, string> = {
  N: '核(N)', B: '生物(B)', C: '化学(C)', M: 'ミサイル(M)', K: '通常兵器(K)',
}

function parseConcernCategories(cell: unknown): string[] {
  const s = String(cell ?? '').trim()
  if (!s) return []
  return s
    .split(/[,、・\s/・]+/)
    .map(p => p.trim().toUpperCase())
    .filter(Boolean)
    .map(p => CONCERN_MAP[p] ?? p)
}

/** METIページからExcel URLを自動検出 */
async function findExcelUrl(): Promise<string> {
  if (process.env.METI_FOREIGN_USER_LIST_URL) {
    return process.env.METI_FOREIGN_USER_LIST_URL
  }

  const res = await fetch(METI_PAGE_URL, {
    headers: { 'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)' },
  })
  if (!res.ok) throw new Error(`METI page fetch failed: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  let excelUrl = ''
  $('a[href$=".xlsx"], a[href$=".xls"]').each((_, el) => {
    if (excelUrl) return
    const href = $(el).attr('href') ?? ''
    const text = $(el).text()
    if (text.includes('ユーザー') || text.includes('user') || href.toLowerCase().includes('user')) {
      excelUrl = href.startsWith('http') ? href : `https://www.meti.go.jp${href}`
    }
  })

  // キーワード一致なし → 最初のExcelリンクをフォールバック
  if (!excelUrl) {
    const first = $('a[href$=".xlsx"]').first().attr('href') ?? ''
    if (first) excelUrl = first.startsWith('http') ? first : `https://www.meti.go.jp${first}`
  }

  if (!excelUrl) throw new Error('外国ユーザーリストのExcelファイルが見つかりませんでした')
  return excelUrl
}

/** ExcelシートからエントリをパースしてSupabaseに保存 */
export async function syncForeignUserList(
  supabase: SupabaseClient,
): Promise<{ inserted: number; total: number; source_url: string }> {
  const excelUrl = await findExcelUrl()

  const res = await fetch(excelUrl, {
    headers: { 'User-Agent': 'ExportControlNewsBot/1.0 (+https://export-control-news.vercel.app)' },
  })
  if (!res.ok) throw new Error(`Excel fetch failed: ${res.status} ${excelUrl}`)

  const buf = await res.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buf), { type: 'array' })

  const entries: { name: string; country: string; address: string; concern_categories: string[] }[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as string[][]

    // ヘッダー行を探す（最初の10行以内）
    let headerRow = -1
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const joined = rows[i].join(' ')
      if (joined.includes('企業') || joined.includes('組織') || joined.includes('国') || joined.includes('Country')) {
        headerRow = i
        break
      }
    }
    if (headerRow === -1) continue

    const headers = rows[headerRow].map(h => String(h).trim().toLowerCase())
    const nameIdx    = headers.findIndex(h => h.includes('企業') || h.includes('組織') || h.includes('name'))
    const countryIdx = headers.findIndex(h => h.includes('国') || h.includes('country'))
    const addressIdx = headers.findIndex(h => h.includes('住所') || h.includes('所在') || h.includes('address'))
    const concernIdx = headers.findIndex(h => h.includes('懸念') || h.includes('区分'))

    if (nameIdx === -1) continue

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i]
      const name = String(row[nameIdx] ?? '').trim()
      if (!name) continue

      entries.push({
        name,
        country: countryIdx >= 0 ? String(row[countryIdx] ?? '').trim() : '',
        address: addressIdx >= 0 ? String(row[addressIdx] ?? '').trim() : '',
        concern_categories: concernIdx >= 0 ? parseConcernCategories(row[concernIdx]) : [],
      })
    }
  }

  if (entries.length === 0) throw new Error('外国ユーザーリストのパースに失敗しました（0件）')

  const { error: delErr } = await supabase
    .from('screening_list_entries')
    .delete()
    .eq('list_source', LIST_SOURCE)
  if (delErr) throw new Error(`FUL delete error: ${delErr.message}`)

  let inserted = 0
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(e => ({
      list_source: LIST_SOURCE,
      name: e.name,
      aliases: [],
      country: e.country || null,
      address: e.address || null,
      concern_categories: e.concern_categories,
      notes: null,
      synced_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('screening_list_entries').insert(batch)
    if (error) throw new Error(`FUL insert error: ${error.message}`)
    inserted += batch.length
  }

  return { inserted, total: entries.length, source_url: excelUrl }
}
