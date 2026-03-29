import type { SupabaseClient } from '@supabase/supabase-js'

export interface ListSearchResult {
  id: string
  list_source: string
  name: string
  aliases: string[]
  country: string | null
  address: string | null
  concern_categories: string[]
  notes: string | null
}

const LEGAL_SUFFIXES =
  /\b(LLC|Inc|Corp|Ltd|Co|GmbH|AG|SA|BV|NV|PLC|Pty|JSC|CJSC|PJSC|SAS|SRL|SpA|OOO|PAO|OAO|OJSC|FGUP)\b\.?/gi

/** 顧客名から検索キーワードを抽出（法人格・記号を除去）*/
export function extractKeywords(name: string): string[] {
  const cleaned = name.replace(LEGAL_SUFFIXES, '').replace(/[^\w\s]/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(w => w.length >= 3)
  return words.filter((w, i) => words.indexOf(w) === i)
}

/** screening_list_entries をキーワード検索して類似エントリを返す */
export async function searchListEntries(
  supabase: SupabaseClient,
  customerName: string,
  country?: string,
): Promise<ListSearchResult[]> {
  if (!customerName.trim()) return []

  const keywords = extractKeywords(customerName)
  if (keywords.length === 0) return []

  // 最長キーワードから順に試す
  const sorted = [...keywords].sort((a, b) => b.length - a.length)

  for (const kw of sorted) {
    let query = supabase
      .from('screening_list_entries')
      .select('id, list_source, name, aliases, country, address, concern_categories, notes')
      .ilike('name', `%${kw}%`)

    // 国名が指定されている場合は絞り込み（部分一致・null も許容）
    if (country) {
      const c = country.trim()
      query = query.or(`country.ilike.%${c}%,country.is.null`)
    }

    const { data } = await query.limit(20)
    if (data && data.length > 0) return data
  }

  return []
}
