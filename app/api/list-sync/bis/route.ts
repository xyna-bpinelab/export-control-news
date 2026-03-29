import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { syncBisEntityList } from '@/lib/list-sync/bis'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceRoleClient()
    const result = await syncBisEntityList(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
