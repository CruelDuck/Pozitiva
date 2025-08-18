'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SourceRow = { title: string; url: string }
type Category = { id: string; title: string | null; slug: string | null }

export default function NewPostPage() {
  // texty
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')

  // obrázek + práva
  const [img, setImg] = useState('')
  const [imageCredit, setImageCredit] = useState('')
  const [imageLicense, setImageLicense] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')

  // kategorie (UUID!)
  const [cats, setCats] = useState<Category[]>([])
  const [sel, setSel] = useState<string[]>([]) // vybrané UUID

  // zdroje
  const [sources, setSources] = useState<SourceRow[]>([{ title: '', url: '' }])

  // galerie
  const [gallery, setGallery] = useState<any[] | null>(null)
  const [showGallery, setShowGallery] = useState(false)

  // UX
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // načíst kategorie
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id,title,slug')
        .order('title', { ascending: true })
      if (!error && data) setCats(data as Category[])
    })()
  }, [])

  // upload do Blob/Storage (zajištěno /api/upload)
  const upload = async (file: File) => {
    setErr(null); setMsg(null)
    const res = await fetch('/api/upload?filename=' + encodeURIComponent(file.name), {
      method: 'POST',
      body: file,
    })
    const data = await res.json()
    if (!res.ok || !data?.url) {
      setErr(data?.error || 'Nahrávání selhalo')
      return
    }
    setImg(data.url)
    setMsg('Obrázek nahrán')
  }

  // otevřít galerii
  const openGallery = async () => {
    setShowGallery(true)
    if (gallery === null) {
      const res = await fetch('/api/blob/list')
      const data = await res.json()
      setGallery(data.items || [])
      if (data?.error) setErr('Galerie: ' + data.error)
    }
  }

  // uložení konceptu
  const submit = async () => {
    setErr(null); setMsg(null); setSubmitting(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        setErr('Musíš být přihlášen.')
        return
      }

      // vlož příspěvek
      const { data: inserted, error: e1 } = await supabase
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

      if (e1 || !inserted) {
        setErr(e1?.message || 'Vkládání článku selhalo')
        return
      }
      const pid = inserted.id as string

      // kategorie (UUID) – pokud nějaké vybrané
      if (sel.length) {
        const rows = sel.map((id) => ({ post_id: pid, category_id: id }))
        const insCats = await supabase.from('post_categories').insert(rows)
        if (insCats.error) {
          setErr('Ukládání kategorií selhalo: ' + insCats.error.message)
          return
        }
      }

      // zdroje (jen vyplněné URL)
      const normSources = (sources || [])
        .filter((s) => s.url?.trim())
        .map((s) => ({ post_id: pid, title: s.title || null, url: s.url.trim() }))
      if (normSources.length) {
        const insSrc = await supabase.from('post_sources').insert(normSources)
        if (insSrc.error) {
          setErr('Ukládání zdrojů selhalo: ' + insSrc.error.message)
          return
        }
      }

      setMsg('Uloženo jako koncept.')
      // reset formuláře
      setTitle(''); setExcerpt(''); setContent('')
      setImg(''); setImageCredit(''); setImageLicense(''); setImageSourceUrl('')
      setSel([]); setSources([{ title: '', url: '' }])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* HLAVIČKA */}
      <section className="card p-5 space-y-3">
        <h1 className="text-xl font-semibold">Nový článek</h1>

        <div>
          <label className="label">Titulek</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="label">Perex</label>
          <textarea
            className="input min-h-24"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </div>

        <div>
          <label className="label">Obsah</label>
          <textarea
            className="input min-h-48"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </section>

      {/* OBRÁZEK */}
      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Obrázek</h2>

        {img && <img src={img} className="w-full rounded-xl mb-2" />}

        <div className="flex flex-wrap gap-2">
          <label className="btn cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => e.target.files && upload(e.target.files[0])}
            />
            Vybrat soubor
          </label>
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
            {!gallery?.length && (
              <div className="text-sm text-zinc-500">Galerie je prázdná.</div>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-2 mt-1">
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
            placeholder="URL původu"
            value={imageSourceUrl}
            onChange={(e) => setImageSourceUrl(e.target.value)}
          />
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
            const ids = Array.from(e.target.selectedOptions).map((o) => o.value) // UUID
            setSel(ids)
          }}
        >
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title || c.slug || c.id}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">Podrž Ctrl/Cmd pro výběr více kategorií.</p>
      </section>

      {/* ZDROJE */}
      <section className="card p-5 space-y-2">
        <h2 className="font-semibold">Zdroje</h2>
        {sources.map((s, idx) => (
          <div key={idx} className="grid sm:grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Název zdroje"
              value={s.title}
              onChange={(e) =>
                setSources((prev) =>
                  prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                )
              }
            />
            <input
              className="input"
              placeholder="URL zdroje"
              value={s.url}
              onChange={(e) =>
                setSources((prev) =>
                  prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => setSources((prev) => [...prev, { title: '', url: '' }])}
          >
            Přidat zdroj
          </button>
          {sources.length > 1 && (
            <button
              type="button"
              className="btn"
              onClick={() => setSources((prev) => prev.slice(0, -1))}
            >
              Odebrat poslední
            </button>
          )}
        </div>
      </section>

      {/* AKCE – sticky */}
      <div className="sticky bottom-4 z-10">
        <div className="card p-4 flex flex-wrap gap-2 items-center justify-between">
          <div className="text-sm">
            {err ? <span className="text-red-600">{err}</span> : (msg || '—')}
          </div>
          <button className="btn" onClick={submit} disabled={submitting}>
            {submitting ? 'Ukládám…' : 'Uložit koncept'}
          </button>
        </div>
      </div>
    </div>
  )
}