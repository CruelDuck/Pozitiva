import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Chybí token' }, { status: 400 })
  const { error } = await supabase.from('newsletter_subscribers').update({ confirmed_at: new Date().toISOString() }).eq('token', token)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse('<h1>Odběr potvrzen ✅</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
