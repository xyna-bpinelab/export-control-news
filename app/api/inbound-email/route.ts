import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { parseInboundEmail } from '@/lib/collectors/email'
import { deduplicateItems } from '@/lib/collectors/dedup'
import { hashUrl, normalizeUrl } from '@/lib/utils/text'

export const dynamic = 'force-dynamic'

// SendGrid Inbound Parse は multipart/form-data で POST
export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const from = formData.get('from')?.toString() ?? ''
  const subject = formData.get('subject')?.toString() ?? ''
  const text = formData.get('text')?.toString() ?? ''
  const html = formData.get('html')?.toString() ?? null
  const date = formData.get('headers')?.toString().match(/Date: (.+)/)?.[1] ?? null

  const item = parseInboundEmail({ from, subject, text, html, date })
  if (!item) {
    return NextResponse.json({ ok: false, reason: 'filtered or no URL found' })
  }

  const supabase = createServiceRoleClient()

  // 重複確認
  const newItems = await deduplicateItems(supabase, [item])
  if (newItems.length === 0) {
    return NextResponse.json({ ok: false, reason: 'duplicate' })
  }

  const normalized = normalizeUrl(item.url)
  const { error } = await supabase.from('articles').insert({
    source_id: null, // メールはsource特定困難な場合あり
    title: item.title,
    url: normalized,
    url_hash: hashUrl(normalized),
    content_text: item.content_text,
    published_at: item.published_at?.toISOString() ?? null,
    lang: item.lang,
    category: item.category ?? null,
    tags: [],
    status: 'collected',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
