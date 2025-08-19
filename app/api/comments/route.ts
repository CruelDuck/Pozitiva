// app/api/comments/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
)

type Body = {
  postId: string
  content: string
  parentId?: number | null
  turnstileToken?: string
}

async function verifyTurnstile(token?: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true }            // DEV: bez ověřování
  if (!token) return { ok: false, error: 'Chybí ověření (captcha).' }

  const form = new URLSearchParams()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const data = await r.json()
  if (!data?.success) return { ok: false, error: 'Neprošla verifikace CAPTCHA.' }
  return { ok: true }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const { postId, content, parentId = null, turnstileToken } = body || {}

    if (!postId || !content?.trim()) {
      return NextResponse.json({ error: 'Chybí postId nebo obsah.' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Komentář je příliš dlouhý.' }, { status: 400 })
    }

    // CAPTCHA (prod) / přeskoč (dev)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || null
    const v = await verifyTurnstile(turnstileToken, ip)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    // uživatel z Authorization: Bearer <jwt>
    const authHeader = req.headers.get('authorization')
    const userInfo = await userFromAuthHeader(authHeader)
    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Nejsi přihlášen.' }, { status: 401 })
    }

    // ⬇⬇⬇ KLÍČOVÉ: vložení přes RPC, ne přes .from('comments')
    const { data, error } = await supa
      .rpc('add_comment', { pid: postId, uid: userInfo.id, txt: content.trim(), parent: parentId })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ ok: true, id: row?.id, created_at: row?.created_at })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

async function userFromAuthHeader(authHeader: string | null): Promise<{ id: string | null }> {
  try {
    if (!authHeader?.toLowerCase().startsWith('bearer ')) return { id: null }
    const jwt = authHeader.split(' ')[1]
    const payloadStr = Buffer.from((jwt.split('.')[1] || ''), 'base64').toString('utf8')
    const payload = JSON.parse(payloadStr)
    return { id: (payload?.sub as string) || null }
  } catch {
    return { id: null }
  }
}
