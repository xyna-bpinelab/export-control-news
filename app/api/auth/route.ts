import { NextResponse } from 'next/server'

const PASSWORD = process.env.SITE_PASSWORD ?? '3776'

export async function POST(req: Request) {
  const { password } = await req.json()

  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('site_auth', 'ok', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30日
    path: '/',
  })
  return res
}
