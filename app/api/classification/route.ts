import { NextResponse } from 'next/server'
import { runClassification } from '@/lib/ai/classifier'
import type { ClassificationInput } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Partial<ClassificationInput>

  if (!input.product_name?.trim()) {
    return NextResponse.json({ error: '品名・型番を入力してください。' }, { status: 400 })
  }

  const classificationInput: ClassificationInput = {
    product_name: input.product_name ?? '',
    description: input.description ?? '',
    specs: input.specs ?? '',
    destination_country: input.destination_country ?? '',
    end_use: input.end_use ?? '',
  }

  try {
    const result = await runClassification(classificationInput)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
