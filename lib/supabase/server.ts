import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Server Component / Route Handler 用（anon key + RLS）
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// Cron Job / Webhook 用（service role key、RLS バイパス）
//
// Next.js は Node ランタイムの fetch をパッチして Data Cache を適用するため、
// supabase-js の内部 fetch（デフォルトの global fetch）がデプロイ単位でキャッシュされ、
// ルートの dynamic='force-dynamic' だけでは内部の SELECT が古いまま固定されることがある
// （cron/summarize が毎回同じ「未処理トップN件」を再取得し続けるバグの原因だった）。
// 明示的に cache: 'no-store' を指定してキャッシュを無効化する。
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    },
  )
}
