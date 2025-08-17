'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SourceRow = { title: string; url: string }

export default function NewPostPage() {
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [cats, setCats] = useState<any[]>([])
  const [sel, setSel] = useState<number[]>([])
  const [img, setImg] = useState('')
  const [imageCredit, setImageCredit] = useState('')
  const [imageLicense, setImageLicense] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')
  const [sources, setSources] = useState<SourceRow[]>([{ title: '', url: '' }])
  const [msg, setMsg] = useState<string | null>(null)
  const [gallery, setGallery] = useState<any[] | null>(null)
  const [showGallery, setShowGallery] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setCats(data || []))
  }, [])

  const upload = async (file: File) => {
    const res = await fetch('/api/upload?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      body: file,
    })
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

  const submit = async () => {
    setMsg(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setMsg('Musíš být přihlášen.')
      return
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        title,
        excerpt: excerpt || null,
        content,
        image_url: img || null,
        image_credit: imageCredit || null,
        image_license: imageLicense || null,
        image_source_url: imageSourceUrl || null,
        is_published: false,
      })
      .select('id')
      .single()

    if (error) {
      setMsg(error.message)
      return
    }

    const pid = data.id

    if (sel.length) {
      await supabase.from('post_categories').insert(sel.map((id) => ({ post_id: pid, category_id: id })))
    }

    const normSources = (sources || [])
      .filter((s) => s.url?.trim())
      .map((s) => ({ post_id: pid, title: s.title || null, url: s.url.trim() }))
    if (normSources.length) await supabase.from('post_sources').insert(normSources)

    setMsg('Uloženo jako koncept.')
    setTitle('')
    setExcerpt('')
    setContent('')
    setSel([])
    setImg('')
    setImageCredit('')
    setImageLicense('')
    setImageSourceUrl('')
    setSources([{ title: '', url: '' }])
  }

  return (
    <div className="max-w-2xl mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-bold">Nový článek</h1>

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
          <button type="button" className="btn" onClick={openGallery}>
            Vybrat z galerie
          </button>
        </div>

        {showGallery && (
          <div className="mt-3 p-3 border rounded-xl bg-zinc-50 max-h-64 overflow-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(gallery || []).map((b: any) => (
                <button
                  type="button"
                  key={b.url}
                  className="border rounded-lg overflow-hidden"
                  onClick={() => {
                    setImg(b.url)
                    setShowGallery(false)
                  }}
                >
                  <img src={b.url} className="w-full h-24 object-cover" />
                </button>
              ))}
            </div>
            {!gallery?.length && <div className="text-sm text-zinc-500">Galerie je prázdná.</div>}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <input
            className="input"
            placeholder="Autor / Zdroj obrázku"
            value={imageCredit}
            onChange={(e) => setImageCredit(e.target.value)}
          />
          <input
            className="input"
            placeholder="Licence (např. CC BY 4.0)"
            value={imageLicense}
            onChange={(e) => setImageLicense(e.target.value)}
          />
          <input
            className="input"
            placeholder="URL původu obrázku"
            value={imageSourceUrl}
            onChange={(e) => setImageSourceUrl(e.target.value)}
          />
        </div>
        <div className="text-xs text-zinc-500 mt-1">Vyplň kvůli autorským právům.</div>
      </div>

      <div className="space-y-2">
        <div className="label">Zdroje (můžeš přidat více)</div>
        {sources.map((s, idx) => (
          <div key={idx} className="grid sm:grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Název zdroje"
              value={s.title}
              onChange={(e) =>
                setSources((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
              }
            />
            <input
              className="input"
              placeholder="URL zdroje"
              value={s.url}
              onChange={(e) =>
                setSources((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setSources((prev) => [...prev, { title: '', url: '' }])}>
            Přidat zdroj
          </button>
          {sources.length > 1 && (
            <button type="button" className="btn" onClick={() => setSources((prev) => prev.slice(0, -1))}>
              Odebrat poslední
            </button>
          )}
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

      <button className="btn" onClick={submit}>
        Uložit koncept
      </button>
      {msg && <div className="text-sm text-zinc-600">{msg}</div>}
    </div>
  )
}