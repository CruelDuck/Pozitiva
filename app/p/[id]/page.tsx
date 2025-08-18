'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Post = {
  id: string
  title: string | null
  slug: string | null
  excerpt: string | null
  content: string | null
  image_url: string | null
  image_credit: string | null
  image_license: string | null
  image_source_url: string | null
  is_published: boolean | null
  published_at: string | null
  views?: number | null
}

type Source = { id: number; title: string | null; url: string | null }
type Comment = { id: number; content: string; created_at: string; user_id: string | null }

export default function PostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const [cText, setCText] = useState('')
  const [cMsg, setCMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // načti článek, zdroje a komentáře
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      const ident = params.id

      // rozlišíme slug vs UUID
      const byUuid = /^[0-9a-f-]{32,}$/i.test(ident)
      const sel =
        'id,title,slug,excerpt,content,image_url,image_credit,image_license,image_source_url,is_published,published_at,views'

      const q = supabase.from('posts').select(sel).limit(1)
      const { data: rows, error } = byUuid
        ? await q.eq('id', ident)
        : await q.eq('slug', ident)

      if (error || !rows?.length) {
        if (!cancelled) {
          setErr(error?.message || 'Příspěvek nenalezen.')
          setLoading(false)
        }
        return
      }
      const p = rows[0] as Post
      if (!p.is_published) {
        if (!cancelled) {
          setErr('Tento příspěvek není publikovaný.')
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setPost(p)
      }

      // zdroje
      const { data: srcs } = await supabase
        .from('post_sources')
        .select('id,title,url')
        .eq('post_id', p.id)
        .order('id', { ascending: true })
      if (!cancelled) setSources((srcs || []) as Source[])

      // komentáře
      const { data: cms } = await supabase
        .from('comments')
        .select('id,content,created_at,user_id')
        .eq('post_id', p.id)
        .order('created_at', { ascending: false })
      if (!cancelled) setComments((cms || []) as Comment[])

      // započti zobrazení (nezáleží na přihlášení)
      try {
        await fetch('/api/posts/view', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ postId: p.id }),
        })
      } catch {
        // ignoruj – když se nepovede, článek se i tak zobrazí
      }

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [params.id])

  // hezké formátování datumu
  const published = useMemo(() => {
    if (!post?.published_at) return null
    try {
      return new Date(post.published_at).toLocaleString('cs-CZ')
    } catch {
      return post.published_at
    }
  }, [post?.published_at])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    setCMsg(null)
    if (!post) return

    // auth token pro Authorization: Bearer
    const { data: session } = await supabase.auth.getSession()
    const accessToken = session?.session?.access_token
    if (!accessToken) {
      setCMsg('Musíš být přihlášen.')
      return
    }

    const tokenInput = formRef.current?.querySelector(
      'input[name="cf-turnstile-response"]'
    ) as HTMLInputElement | null
    const turnstileToken = tokenInput?.value || ''

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        postId: post.id,
        content: cText,
        turnstileToken,
      }),
    })
    const out = await res.json()
    if (!res.ok) {
      setCMsg(out.error || 'Komentář se nepodařilo odeslat.')
      return
    }

    setCMsg('Díky za komentář!')
    setCText('')

    // znovu načti komentáře
    const { data: cms } = await supabase
      .from('comments')
      .select('id,content,created_at,user_id')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
    setComments((cms || []) as Comment[])
  }

  if (loading) return <div>Načítám…</div>
  if (err) return <div className="text-red-600">{err}</div>
  if (!post) return null

  return (
    <div className="space-y-6">
      {/* HLAVIČKA */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-zinc-700">{post.excerpt}</p>}
        <div className="text-xs text-zinc-500">
          {published ? <>Publikováno: {published} · </> : null}
          {typeof post.views === 'number' ? <>Zobrazení: {post.views}</> : null}
        </div>
      </header>

      {/* OBRÁZEK */}
      {post.image_url && (
        <figure>
          <img src={post.image_url} alt="" className="w-full rounded-xl" />
          {(post.image_credit || post.image_license || post.image_source_url) && (
            <figcaption className="text-xs text-zinc-500 mt-1">
              {post.image_credit && <span>© {post.image_credit}. </span>}
              {post.image_license && <span>Licence: {post.image_license}. </span>}
              {post.image_source_url && (
                <a className="underline" href={post.image_source_url} target="_blank" rel="noreferrer">
                  Zdroj
                </a>
              )}
            </figcaption>
          )}
        </figure>
      )}

      {/* OBSAH */}
      {post.content && (
        <article className="prose max-w-none whitespace-pre-wrap">
          {post.content}
        </article>
      )}

      {/* ZDROJE */}
      {!!sources.length && (
        <section className="card p-4">
          <h3 className="font-semibold mb-2">Zdroje</h3>
          <ul className="list-disc pl-6">
            {sources.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} className="underline" target="_blank" rel="noreferrer">
                    {s.title || s.url}
                  </a>
                ) : (
                  <span>{s.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* KOMENTÁŘE */}
      <section className="card p-4 space-y-4">
        <h3 className="font-semibold">Komentáře</h3>

        <form ref={formRef} onSubmit={submitComment} className="space-y-3">
          <textarea
            className="input min-h-24"
            placeholder="Vaše myšlenka…"
            value={cText}
            onChange={(e) => setCText(e.target.value)}
            required
          />
          {/* Cloudflare Turnstile (script je v layoutu) */}
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
          />
          <button className="btn" type="submit">
            Odeslat
          </button>
          {cMsg && <div className="text-sm text-zinc-600">{cMsg}</div>}
        </form>

        <ul className="space-y-3">
          {comments.length ? (
            comments.map((c) => (
              <li key={c.id} className="border-b last:border-none pb-3">
                <div className="text-xs text-zinc-500">
                  {new Date(c.created_at).toLocaleString('cs-CZ')}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{c.content}</div>
              </li>
            ))
          ) : (
            <li className="text-zinc-500">Zatím žádné komentáře.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
