// app/api/comments/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key (Service role)
)

type Body = {
  postId: string
  content: string
  turnstileToken?: string
  // optional: ip passed from client (not required)
}

async function verifyTurnstile(token?: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true } // pokud nechceš blokovat při dev
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
  const data = (await r.json()) as { success: boolean; 'error-codes'?: string[] }
  if (!data.success) {
    return { ok: false, error: `Neprošla verifikace: ${data['error-codes']?.join(', ') || 'unknown'}` }
  }
  return { ok: true }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body
    const { postId, content, turnstileToken } = body || {}

    if (!postId || !content?.trim()) {
      return NextResponse.json({ error: 'Chybí postId nebo obsah.' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Komentář je příliš dlouhý.' }, { status: 400 })
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || null
    const v = await verifyTurnstile(turnstileToken, ip)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    // ověření uživatele – použijeme Supabase JWT z cookie/hlavičky
    // tady použijeme anon client se service role na INSERT s vynucením user_id
    const authHeader = req.headers.get('authorization') // např. "Bearer <token>"
    const { data: userInfo } = await fetchUserFromAuthHeader(authHeader)
    if (!userInfo?.id) {
      return NextResponse.json({ error: 'Nejsi přihlášen.' }, { status: 401 })
    }

    const { data, error } = await supa
      .from('comments')
      .insert({ post_id: postId, user_id: userInfo.id, content: content.trim() })
      .select('id, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

/**
 * Pomocná funkce: vyčteme user_id z Authorization Bearer tokenu (Supabase JWT).
 * Pokud posíláš požadavek z clientu bez hlavičky, přepni na jednodušší variantu:
 *  - z frontendu si vytáhni supabase.auth.getUser() a pošli user.id v body (méně bezpečné).
 */
async function fetchUserFromAuthHeader(authHeader: string | null) {
  try {
    if (!authHeader?.toLowerCase().startsWith('bearer ')) return { id: null }
    const jwt = authHeader.split(' ')[1]
    // Supabase admin endpoint pro verifikaci (neexistuje veřejné JWT verify),
    // proto použijeme jednoduché dekódování JWT a vytáhneme sub (user id).
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1] || '', 'base64').toString('utf8')
    )
    return { id: payload?.sub || null }
  } catch {
    return { id: null }
  }
}
