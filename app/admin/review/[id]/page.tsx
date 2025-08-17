'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Review({ params }: { params: { id: string } }) {
  const [p, setP] = useState<any>(null)
  const [cats, setCats] = useState<any[]>([])
  const [sel, setSel] = useState<number[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('posts').select('*').eq('id', params.id).maybeSingle()
      setP(data || undefined)
      const { data: rels } = await supabase
        .from('post_categories')
        .select('category_id')
        .eq('post_id', params.id)
      setSel((rels || []).map((r: any) => r.category_id))
      const { data: srcs } = await supabase.from('post_sources').select('*').eq('post_id', params.id)
      setSources(srcs || [])
      const { data: c } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      setCats(c || [])
    })()
  }, [params.id])

  if (p === undefined) return <div>Článek nenalezen.</div>
  if (!p) return <div>Načítám…</div>

  const save = async () => {
    setMsg(null)
    const { error } = await supabase
      .from('posts')
      .update({
        title: p.title,
        excerpt: p.excerpt,
        content: p.content,
        image_url: p.image_url,
        slug: p.slug,
        image_credit: p.image_credit || null,
        image_license: p.image_license || null,
        image_source_url: p.image_source_url || null,
      })
      .eq('id', p.id)
    if (error) {
      setMsg(error.message)
      return
    }
    await supabase.from('post_categories').delete().eq('post_id', p.id)
    if (sel.length) {
      await supabase.from('post_categories').insert(sel.map((id) => ({ post_id: p.id, category_id: id })))
    }
    await supabase.from('post_sources').delete().eq('post_id', p.id)
    if (sources.length) {
      await supabase
        .from('post_sources')
        .insert(sources.map((s: any) => ({ post_id: p.id, title: s.title || null, url: s.url })))
    }
    setMsg('Uloženo.')
  }

  const publish = async (on: boolean) => {
    const payload: any = { is_published: on }
    if (on) payload.published_at = new Date().toISOString()
    await supabase.from('posts').update(payload).eq('id', p.id)
    setP((prev: any) => ({ ...prev, ...payload }))
  }

  return (
    <div className="max-w-3xl mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-bold">Revize článku</h1>

      <div>
        <div className="label">Titulek</div>
        <input className="input" value={p.title || ''} onChange={(e) => setP({ ...p, title: e.target.value })} />
      </div>

      <div>
        <div className="label">Perex</div>
        <textarea
          className="input min-h-20"
          value={p.excerpt || ''}
          onChange={(e) => setP({ ...p, excerpt: e.target.value })}
        />
      </div>

      <div>
        <div className="label">Obsah</div>
        <textarea
          className="input min-h-40"
          value={p.content || ''}
          onChange={(e) => setP({ ...p, content: e.target.value })}
        />
      </div>

      <div>
        <div className="label">Obrázek URL</div>
        <input
          className="input"
          value={p.image_url || ''}
          onChange={(e) => setP({ ...p, image_url: e.target.value })}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <div className="label">Autor/Zdroj obrázku</div>
          <input
            className="input"
            value={p.image_credit || ''}
            onChange={(e) => setP({ ...p, image_credit: e.target.value })}
          />
        </div>
        <div>
          <div className="label">Licence</div>
          <input
            className="input"
            value={p.image_license || ''}
            onChange={(e) => setP({ ...p, image_license: e.target.value })}
          />
        </div>
        <div>
          <div className="label">URL původu</div>
          <input
            className="input"
            value={p.image_source_url || ''}
            onChange={(e) => setP({ ...p, image_source_url: e.target.value })}
          />
        </div>
      </div>

      <div>
        <div className="label">Kategorie</div>
        <select
          className="input"
          multiple
          value={sel.map(String)}
          onChange={(e) => {
            const opts = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
            setSel(opts)
          }}
        >
          {cats.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-zinc-500 mt-1">Podrž Ctrl/Cmd pro výběr více kategorií.</div>
      </div>

      <div>
        <div className="label">Zdroje</div>
        {sources.map((s: any, idx: number) => (
          <div key={idx} className="grid sm:grid-cols-2 gap-2 mb-2">
            <input
              className="input"
              placeholder="Název"
              value={s.title || ''}
              onChange={(e) =>
                setSources((prev) => prev.map((x: any, i: number) => (i === idx ? { ...x, title: e.target.value } : x)))
              }
            />
            <input
              className="input"
              placeholder="URL"
              value={s.url || ''}
              onChange={(e) =>
                setSources((prev) => prev.map((x: any, i: number) => (i === idx ? { ...x, url: e.target.value } : x)))
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button className="btn" onClick={() => setSources((prev) => [...prev, { title: '', url: '' }])}>
            Přidat zdroj
          </button>
          {sources.length > 0 && (
            <button className="btn" onClick={() => setSources((prev) => prev.slice(0, -1))}>
              Odebrat poslední
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn" onClick={save}>
          Uložit
        </button>
        {!p.is_published ? (
          <button className="btn" onClick={() => publish(true)}>
            Publikovat
          </button>
        ) : (
          <button className="btn" onClick={() => publish(false)}>
            Odepublikovat
          </button>
        )}
      </div>
      {msg && <div className="text-sm text-zinc-600">{msg}</div>}
    </div>
  )
}