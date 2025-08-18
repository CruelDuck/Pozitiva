'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SourceRow = { id?: number; title: string; url: string }

export default function EditPostPage({ params }: { params: { id: string } }) {
  const postId = params.id

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [img, setImg] = useState('')
  const [imageCredit, setImageCredit] = useState('')
  const [imageLicense, setImageLicense] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')

  const [cats, setCats] = useState<any[]>([])
  const [sel, setSel] = useState<number[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])

  const [gallery, setGallery] = useState<any[] | null>(null)
  const [showGallery, setShowGallery] = useState(false)

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState<boolean>(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr(null)

      // načti post
      const { data: p, error: e1 } = await supabase
        .from('posts')
        .select('id,title,excerpt,content,image_url,image_credit,image_license,image_source_url,is_published')
        .eq('id', postId)
        .maybeSingle()
      if (e1 || !p) {
        setErr(e1?.message || 'Článek nenalezen')
        setLoading(false)
        return
      }

      setTitle(p.title || '')
      setExcerpt(p.excerpt || '')
      setContent(p.content || '')
      setImg(p.image_url || '')
      setImageCredit(p.image_credit || '')
      setImageLicense(p.image_license || '')
      setImageSourceUrl(p.image_source_url || '')
      setIsPublished(!!p.is_published)

      // kategorie (všechny)
      const { data: allCats } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      setCats(allCats || [])

      // vybrané kategorie
      const { data: rels } = await supabase
        .from('post_categories')
        .select('category_id')
        .eq('post_id', postId)
      setSel((rels || []).map((r: any) => r.category_id))

      // zdroje
      const { data: srcs } = await supabase
        .from('post_sources')
        .select('id,title,url')
        .eq('post_id', postId)
        .order('id', { ascending: true })
      setSources((srcs || []).map((s: any) => ({ id: s.id, title: s.title || '', url: s.url || '' })))

      setLoading(false)
    })()
  }, [postId])

  const upload = async (file: File) => {
    const res = await fetch('/api/upload?filename=' + encodeURIComponent(file.name), { method: 'POST', body: file })
    const data = await res.json()
    if (data.url) setImg(data.url)
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
    setMsg(null); setErr(null)

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

    if (e1) { setErr(e1.message); return }

    // update kategorií – smaž a vlož
    await supabase.from('post_categories').delete().eq('post_id', postId)
    if (sel.length) {
      await supabase.from('post_categories').insert(sel.map((id) => ({ post_id: postId, category_id: id })))
    }

    // update zdrojů – smaž a vlož (jednodušší a spolehlivé)
    await supabase.from('post_sources').delete().eq('post_id', postId)
    const normSources = (sources || []).filter((s) => s.url?.trim()).map((s) => ({
      post_id: postId,
      title: s.title || null,
      url: s.url.trim(),
    }))
    if (normSources.length) await supabase.from('post_sources').insert(normSources)

    setMsg('Uloženo')
  }

  const setPublished = async (to: boolean) => {
    setMsg(null); setErr(null)
    const payload = { is_published: to, published_at: to ? new Date().toISOString() : null }
    const { error } = await supabase.from('posts').update(payload).eq('id', postId)
    if (error) { setErr(error.message); return }
    setIsPublished(to)
    setMsg(to ? 'Publikováno' : 'Vráceno do konceptu')
  }

  if (loading) return <div>Načítám…</div>
  if (err) return <div className="text-red-600">{err}</div>

  return (
    <div className="max-w-2xl mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-bold">Upravit článek</h1>

      <div>
        <div className="label">Titulek</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <div className="label">Perex</div>
        <textarea className="input min-h-20" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      </div>

      <div>
        <div className="label">Obsah</div>
        <textarea className="input min-h-40" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>

      <div>
        <div className="label">Obrázek</div>
        {img && <img src={img} className="w-full rounded-xl mb-2" />}
        <div className="flex flex-wrap gap-2 items-center">
          <input type="file" accept="image/*" onChange={(e) => e.target.files && upload(e.target.files[0])} />
          <button type="button" className="btn" onClick={openGallery}>Vybrat z galerie</button>
        </div>

        {showGallery && (
          <div className="mt-3 p-3 border rounded-xl bg-zinc-50 max-h-64 overflow-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(gallery || []).map((b: any) => (
                <button type="button" key={b.url} className="border rounded-lg overflow-hidden" onClick={() => { setImg(b.url); setShowGallery(false) }}>
                  <img src={b.url} className="w-full h-24 object-cover" />
                </button>
              ))}
            </div>
            {!gallery?.length && <div className="text-sm text-zinc-500">Galerie je prázdná.</div>}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <input className="input" placeholder="Autor / Zdroj obrázku" value={imageCredit} onChange={(e) => setImageCredit(e.target.value)} />
          <input className="input" placeholder="Licence (např. CC BY 4.0)" value={imageLicense} onChange={(e) => setImageLicense(e.target.value)} />
          <input className="input" placeholder="URL původu obrázku" value={imageSourceUrl} onChange={(e) => setImageSourceUrl(e.target.value)} />
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
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <div className="text-xs text-zinc-500 mt-1">Podrž Ctrl/Cmd pro výběr více kategorií.</div>
      </div>

      <div className="space-y-2">
        <div className="label">Zdroje</div>
        {sources.map((s, idx) => (
          <div key={idx} className="grid sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Název zdroje" value={s.title} onChange={(e) => setSources(prev => prev.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} />
            <input className="input" placeholder="URL zdroje" value={s.url} onChange={(e) => setSources(prev => prev.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))} />
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setSources(prev => [...prev, { title: '', url: '' }])}>Přidat zdroj</button>
          {sources.length > 0 && <button type="button" className="btn" onClick={() => setSources(prev => prev.slice(0, -1))}>Odebrat poslední</button>}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="btn" onClick={save}>Uložit</button>
        {!isPublished ? (
          <button className="btn" onClick={() => setPublished(true)}>Publikovat</button>
        ) : (
          <button className="btn" onClick={() => setPublished(false)}>Vrátit do konceptu</button>
        )}
      </div>

      {msg && <div className="text-sm text-zinc-600">{msg}</div>}
    </div>
  )
}