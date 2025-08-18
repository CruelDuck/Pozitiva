import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
)

export async function POST(req: Request) {
  try {
    const { postId } = await req.json()
    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 })

    // jednoduché inkrementování; race condition v praxi nevadí
    const { error } = await supa.rpc('inc_post_views', { pid: postId })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
