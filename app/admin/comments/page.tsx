'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminOnly from '@/components/AdminOnly'
import Link from 'next/link'

type Row = {
  id: number
  content: string
  created_at: string
  is_hidden: boolean | null
  validated: boolean | null
  post_id: string
  post_title: string | null
  post_slug: string | null
  user_id: string | null
  user_name: string | null
}

export default function AdminCommentsPage() {
  return (
    <AdminOnly>
      <CommentsInner />
    </AdminOnly>
  )
}

function CommentsInner() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'unvalidated' | 'hidden'>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      // dotáhneme joinnuté info z posts & profiles (přes mnohonásobné selecty)
      // 1) komentáře
      const { data, error } = await supabase
        .from('comments')
        .select('id,content,created_at,is_hidden,validated,post_id,user_id')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) { setErr(error.message); setLoading(false); return }

      const base = (data || []) as any[]

      // 2) post titles
      const pids = Array.from(new Set(base.map(r => r.post_id).filter(Boolean)))
      let posts: Record<string, { title: string|null, slug: string|null }> = {}
      if (pids.length) {
        const { data: ps } = await supabase
          .from('posts')
          .select('id,title,slug')
          .in('id', pids)
        ;(ps || []).forEach((p: any) => posts[p.id] = { title: p.title, slug: p.slug })
      }

      // 3) user names
      const uids = Array.from(new Set(base.map(r => r.user_id).filter(Boolean)))
      let users: Record<string, string|null> = {}
      if (uids.length) {
        const { data: us } = await supabase
          .from('profiles')
          .select('id,display_name')
          .in('id', uids)
        ;(us || []).forEach((u: any) => users[u.id] = u.display_name)
      }

      if (!cancelled) {
        const out: Row[] = base.map((r: any) => ({
          id: r.id,
          content: r.content,
          created_at: r.created_at,
          is_hidden: r.is_hidden,
          validated: r.validated,
          post_id: r.post_id,
          post_title: posts[r.post_id]?.title ?? null,
          post_slug: posts[r.post_id]?.slug ?? null,
          user_id: r.user_id,
          user_name: (r.user_id && users[r.user_id]) ?? null,
        }))
        setRows(out)
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let arr = rows.slice()
    if (tab === 'unvalidated') arr = arr.filter(r => !r.validated)
    if (tab === 'hidden') arr = arr.filter(r => !!r.is_hidden)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      arr = arr.filter(
        r =>
          (r.content || '').toLowerCase().includes(s) ||
          (r.post_title || '').toLowerCase().includes(s)
      )
    }
    return arr
  }, [rows, tab, q])

  async function toggleValidate(id: number, to: boolean) {
    setErr(null)
    const r = await supabase.from('comments').update({ validated: to }).eq('id', id)
    if (r.error) { setErr(r.error.message); return }
    setRows(prev => prev.map(x => x.id === id ? { ...x, validated: to } : x))
  }

  async function toggleHidden(id: number, to: boolean) {
    setErr(null)
    const r = await supabase.from('comments').update({ is_hidden: to }).eq('id', id)
    if (r.error) { setErr(r.error.message); return }
    setRows(prev => prev.map(x => x.id === id ? { ...x, is_hidden: to } : x))
  }

  async function remove(id: number) {
    setErr(null)
    const r = await supabase.from('comments').delete().eq('id', id)
    if (r.error) { setErr(r.error.message); return }
    setRows(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Komentáře</h1>
        <p className="text-gray-600 mt-1">Validuj, skryj nebo smaž. Vyhledávání funguje přes obsah i název článku.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-white overflow-hidden">
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 text-sm ${tab==='all'?'bg-gray-900 text-white':''}`}>Vše</button>
          <button onClick={() => setTab('unvalidated')} className={`px-3 py-1.5 text-sm ${tab==='unvalidated'?'bg-gray-900 text-white':''}`}>Nevyřízené</button>
          <button onClick={() => setTab('hidden')} className={`px-3 py-1.5 text-sm ${tab==='hidden'?'bg-gray-900 text-white':''}`}>Skryté</button>
        </div>
        <input className="ml-auto w-full sm:w-72 border rounded-lg px-3 py-2 text-sm" placeholder="Hledat…" value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-[40%]">Komentář</th>
              <th className="text-left font-medium px-3 py-2">Článek</th>
              <th className="text-left font-medium px-3 py-2">Uživatel</th>
              <th className="text-left font-medium px-3 py-2">Vytvořen</th>
              <th className="text-left font-medium px-3 py-2">Stav</th>
              <th className="text-left font-medium px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4" colSpan={6}>Načítám…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-4" colSpan={6}>Nic k zobrazení.</td></tr>
            ) : (
              filtered.map(r => {
                const postHref = r.post_slug ? `/p/${r.post_slug}` : `/p/${r.post_id}`
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-3 whitespace-pre-wrap">{r.content}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">
                        <Link href={postHref} target="_blank" className="underline">{r.post_title || '—'}</Link>
                      </div>
                      <div className="text-xs text-zinc-500 break-all">{r.post_id}</div>
                    </td>
                    <td className="px-3 py-3">{r.user_name || (r.user_id ? r.user_id.slice(0,8) : '—')}</td>
                    <td className="px-3 py-3">{new Date(r.created_at).toLocaleString('cs-CZ')}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${r.validated ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {r.validated ? 'Validováno' : 'Nevyřízené'}
                        </span>
                        {r.is_hidden ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-zinc-50 text-zinc-700 border-zinc-200">Skryté</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {!r.validated ? (
                          <button className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={()=>toggleValidate(r.id, true)}>Validovat</button>
                        ) : (
                          <button className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600" onClick={()=>toggleValidate(r.id, false)}>Zneplatnit</button>
                        )}
                        {!r.is_hidden ? (
                          <button className="px-2 py-1 rounded bg-zinc-700 text-white hover:bg-zinc-800" onClick={()=>toggleHidden(r.id, true)}>Skrýt</button>
                        ) : (
                          <button className="px-2 py-1 rounded bg-zinc-500 text-white hover:bg-zinc-600" onClick={()=>toggleHidden(r.id, false)}>Zviditelnit</button>
                        )}
                        <button className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={()=>remove(r.id)}>Smazat</button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
