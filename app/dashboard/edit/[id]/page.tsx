'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SourceRow = { title: string; url: string }
type Category = { id: string; title: string | null; slug: string | null }

export default function EditPostPage({ params }: { params: { id: string } }) {
  const postId = params.id

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // post fields
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')

  // image
  const [img, setImg] = useState('')
  const [imageCredit, setImageCredit] = useState('')
  const [imageLicense, setImageLicense] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')

  // categories (UUID!)
  const [cats, setCats] = useState<Category[]>([])
  const [sel, setSel] = useState<string[]>([]) // UUIDs

  // sources
  const [sources, setSources] = useState<SourceRow[]>([])

  // gallery
  const [gallery, setGallery] = useState<any[] | null>(null)
  const [showGallery, setShowGallery] = useState(false)

  const [isPublished, setIsPublished] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true); setErr(null); setMsg(null)

      // načti článek
      const { data: p, error: e1 } = await supabase
        .from('posts')
        .select('id,title,excerpt,content,image_url,image_credit,image_license,image_source_url,is_published')
        .eq('id', postId)
        .maybeSingle()
      if (e1 || !p) { setErr(e1?.message || 'Článek nenalezen'); setLoading(false); return }

      setTitle(p.title || '')
      setExcerpt(p.excerpt || '')
      setContent(p.content || '')
      setImg(p.image_url || '')
      setImageCredit(p.image_credit || '')
      setImageLicense(p.image_license || '')
      setImageSourceUrl(p.image_source_url || '')
      setIsPublished(!!p.is_published)

      // kategorie – ve tvém schématu: id (uuid), title (text)
      const { data: allCats } = await supabase
        .from('categories')
        .select('id,title,slug')
        .order('title', { ascending: true })
      setCats((allCats || []) as Category[])

      // vybrané kategorie
      const { data: rels } = await supabase
        .from('post_categories')
        .select('category_id')
        .eq('post_id', postId)
      setSel((rels || []).map((r: any) => String(r.category_id)))

      // zdroje
      const { data: srcs } = await supabase
        .from('post_sources')
        .select('title,url')
        .eq('post_id', postId)
        .order('id', { ascending: true })
      setSources((srcs || []).map((s: any) => ({ title: s.title || '', url: s.url || '' })))

      setLoading(false)
    })()
  }, [postId])

  const upload = async (file: File) => {
    setErr(null); setMsg(null)
    const res = await fetch('/api/upload?filename=' + encodeURIComponent(file.name), { method: 'POST', body: file })
    const data = await res.json()
    if (!res.ok || !data?.url) { setErr(data?.error || 'Upload selhal'); return }
    setImg(data.url)
  }

  const openGallery = async () => {
    setShowGallery(true)
    if (gallery === null) {
      const res = await fetch('/api/blob/list')
      const data = await res.json()
      setGallery(data.items || [])
    }
  }

  const save = async () => {
    setErr(null); setMsg(null)

    // update posts
    const { error: e1 } = await supabase
      .from('posts')
      .update({
        title,
        excerpt: excerpt || null,
        content,
        image_url: img || null,
        image_credit: imageCredit || null,
        image_license: imageLicense || null,
        image_source_url: imageSourceUrl || null,
      })
      .eq('id', postId)
    if (e1) { setErr('Uložení článku selhalo: ' + e1.message); return }

    // kategorie (UUID!) – smaž & vlož
    const del = await supabase.from('post_categories').delete().eq('post_id', postId)
    if (del.error) { setErr('Mazání kategorií selhalo: ' + del.error.message); return }
    if (sel.length) {
      const rows = sel.map((id) => ({ post_id: postId, category_id: id }))
      const ins = await supabase.from('post_categories').insert(rows)
      if (ins.error) { setErr('Vkládání kategorií selhalo: ' + ins.error.message); return }
    }

    // zdroje – smaž & vlož
    const delS = await supabase.from('post_sources').delete().eq('post_id', postId)
    if (delS.error) { setErr('Mazání zdrojů selhalo: ' + delS.error.message); return }
    const normSources = sources.filter(s => s.url?.trim()).map(s => ({
      post_id: postId, title: s.title || null, url: s.url.trim()
    }))
    if (normSources.length) {
      const insS = await supabase.from('post_sources').insert(normSources)
      if (insS.error) { setErr('Vkládání zdrojů selhalo: ' + insS.error.message); return }
    }

    setMsg('Uloženo')
  }

  const setPublished = async (to: boolean) => {
    setErr(null); setMsg(null)
    const payload = { is_published: to, published_at: to ? new Date().toISOString() : null }
    const { error } = await supabase.from('posts').update(payload).eq('id', postId)
    if (error) { setErr('Změna stavu selhala: ' + error.message); return }
    setIsPublished(to)
    setMsg(to ? 'Publikováno' : 'Vráceno do konceptu')
  }

  if (loading) return <div>Načítám…</div>
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* TITULEK */}
      <section className="card p-5 space-y-3">
        <h1 className="text-xl font-semibold">Upravit článek</h1>
        <div>
          <label className="label">Titulek</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Perex</label>
          <textarea className="input min-h-24" value={excerpt} onChange={e => setExcerpt(e.target.value)} />
        </div>
        <div>
          <label className="label">Obsah</label>
          <textarea className="input min-h-48" value={content} onChange={e => setContent(e.target.value)} />
        </div>
      </section>

      {/* OBRÁZEK */}
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Obrázek</h2>
        {img && <img src={img} className="w-full rounded-xl mb-2" />}
        <div className="flex flex-wrap gap-2">
          <label className="btn cursor-pointer">
            <input type="file" className="hidden" accept="image/*"
                   onChange={e => e.target.files && upload(e.target.files[0])} />
            Vybrat soubor
          </label>
          <button type="button" className="btn" onClick={openGallery}>Vybrat z galerie</button>
        </div>

        {showGallery && (
          <div className="mt-3 p-3 border rounded-xl bg-zinc-50 max-h-64 overflow-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(gallery || []).map((b: any) => (
                <button key={b.url} type="button" className="border rounded-lg overflow-hidden"
                        onClick={() => { setImg(b.url); setShowGallery(false) }}>
                  <img src={b.url} className="w-full h-24 object-cover" />
                </button>
              ))}
            </div>
            {!gallery?.length && <div className="text-sm text-zinc-500">Galerie je prázdná.</div>}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-1">
          <input className="input" placeholder="Autor / Zdroj obrázku"
                 value={imageCredit} onChange={e => setImageCredit(e.target.value)} />
          <input className="input" placeholder="Licence (např. CC BY 4.0)"
                 value={imageLicense} onChange={e => setImageLicense(e.target.value)} />
          <input className="input" placeholder="URL původu"
                 value={imageSourceUrl} onChange={e => setImageSourceUrl(e.target.value)} />
        </div>
        <p className="text-xs text-zinc-500">Vyplň kvůli autorským právům.</p>
      </section>

      {/* KATEGORIE */}
      <section className="card p-5 space-y-2">
        <h2 className="font-semibold">Kategorie</h2>
        <select
          className="input"
          multiple
          value={sel}
          onChange={(e) => {
            const ids = Array.from(e.target.selectedOptions).map(o => o.value) // UUID!
            setSel(ids)
          }}
        >
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.title || c.slug || c.id}</option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">Podrž Ctrl/Cmd pro výběr více kategorií.</p>
      </section>

      {/* ZDROJE */}
      <section className="card p-5 space-y-2">
        <h2 className="font-semibold">Zdroje</h2>
        {sources.map((s, idx) => (
          <div key={idx} className="grid sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Název" value={s.title}
                   onChange={e => setSources(prev => prev.map((x,i)=> i===idx? {...x, title:e.target.value}:x))} />
            <input className="input" placeholder="URL" value={s.url}
                   onChange={e => setSources(prev => prev.map((x,i)=> i===idx? {...x, url:e.target.value}:x))} />
          </div>
        ))}
        <div className="flex gap-2">
          <button className="btn" onClick={() => setSources(prev => [...prev, { title:'', url:'' }])}>Přidat zdroj</button>
          {sources.length>0 && <button className="btn" onClick={() => setSources(prev => prev.slice(0,-1))}>Odebrat poslední</button>}
        </div>
      </section>

      {/* AKCE – sticky */}
      <div className="sticky bottom-4 z-10">
        <div className="card p-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="text-sm text-zinc-600">{err ? <span className="text-red-600">{err}</span> : (msg || '—')}</div>
          <div className="flex gap-2">
            <button className="btn" onClick={save}>Uložit</button>
            {!isPublished ? (
              <button className="btn" onClick={() => setPublished(true)}>Publikovat</button>
            ) : (
              <button className="btn" onClick={() => setPublished(false)}>Vrátit do konceptu</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}