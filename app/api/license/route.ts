import { NextResponse } from 'next/server'
import { runLicenseAdvisory } from '@/lib/ai/license-advisor'
import type { LicenseInput } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const input = body as Partial<LicenseInput>

  if (!input.destination_country?.trim()) {
    return NextResponse.json({ error: '仕向地国を入力してください。' }, { status: 400 })
  }

  const licenseInput: LicenseInput = {
    eccn: input.eccn ?? '',
    japan_fefta_item: input.japan_fefta_item ?? '',
    destination_country: input.destination_country ?? '',
    end_use: input.end_use ?? '',
    end_user_type: input.end_user_type ?? '',
    transaction_value: input.transaction_value ?? '',
  }

  try {
    const result = await runLicenseAdvisory(licenseInput)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
