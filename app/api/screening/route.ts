import { NextResponse } from 'next/server'
import { runScreening } from '@/lib/ai/screener'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { searchListEntries } from '@/lib/list-sync/search'
import type { ScreeningInput } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Partial<ScreeningInput>

  if (!input.customer_name && !input.country) {
    return NextResponse.json(
      { error: '顧客名または所在地のいずれかを入力してください。' },
      { status: 400 },
    )
  }

  const screeningInput: ScreeningInput = {
    customer_name: input.customer_name ?? '',
    country: input.country ?? '',
    business_description: input.business_description ?? '',
    product: input.product ?? '',
  }

  try {
    // DBからリストを検索してRAGコンテキストとして渡す
    const supabase = createServiceRoleClient()
    const listMatches = await searchListEntries(supabase, screeningInput.customer_name, screeningInput.country)

    const result = await runScreening(screeningInput, listMatches)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
