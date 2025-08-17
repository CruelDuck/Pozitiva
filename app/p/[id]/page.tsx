'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function PostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    (async () => {
      const ident = params.id
      let p = null
      if (ident.length > 20) {
        const { data } = await supabase.from('posts').select('*').eq('id', ident).maybeSingle()
        p = data
      } else {
        const { data } = await supabase.from('posts').select('*').eq('slug', ident).maybeSingle()
        p = data
      }
      if (!p || !p.is_published) {
        setPost(undefined)
        return
      }
      setPost(p)
      const [{ data: srcs }, { data: cms }] = await Promise.all([
        supabase.from('post_sources').select('*').eq('post_id', p.id),
        supabase.from('comments')
          .select('id, content, created_at, user_id')
          .eq('post_id', p.id)
          .order('created_at', { ascending: false }),
      ])
      setSources(srcs || [])
      setComments(cms || [])
    })()
  }, [params.id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!post) return
    // token z Turnstile (přidá hidden input name="cf-turnstile-response")
    const tokenInput = formRef.current?.querySelector(
      'input[name="cf-turnstile-response"]'
    ) as HTMLInputElement | null
    const token = tokenInput?.value || ''
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: post.id, content: text, turnstileToken: token }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg(data.error || 'Chyba')
      return
    }
    setMsg('Komentář odeslán.')
    setText('')
    const { data: cms } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
    setComments(cms || [])
  }

  if (post === undefined) return <div>Příspěvek nenalezen.</div>
  if (!post) return <div>Načítám…</div>

  return (
    <div className="space-y-4">
      <article className="prose max-w-none">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-zinc-700">{post.excerpt}</p>}

        {post.image_url && (
          <figure>
            <img src={post.image_url} alt="" className="w-full rounded-xl" />
            <figcaption className="text-xs text-zinc-500 mt-1">
              {post.image_credit && <span>© {post.image_credit}. </span>}
              {post.image_license && <span>Licence: {post.image_license}. </span>}
              {post.image_source_url && (
                <a className="link" href={post.image_source_url} target="_blank">
                  Zdroj
                </a>
              )}
            </figcaption>
          </figure>
        )}

        <div className="whitespace-pre-wrap mt-4">{post.content}</div>
      </article>

      {!!sources.length && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Zdroje</h3>
          <ul className="list-disc pl-6">
            {sources.map((s: any) => (
              <li key={s.id}>
                <a href={s.url} className="link" target="_blank">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <h3 className="font-semibold">Komentáře</h3>
        <form ref={formRef} onSubmit={submit} className="space-y-3">
          <textarea
            className="input min-h-24"
            placeholder="Vaše myšlenka…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <div
            className="cf-turnstile"
            data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''}
          />
          <button className="btn" type="submit">
            Odeslat
          </button>
          {msg && <div className="text-sm text-zinc-600">{msg}</div>}
        </form>

        <ul className="space-y-3">
          {comments.map((c: any) => (
            <li key={c.id} className="border-b last:border-none pb-3">
              <div className="text-sm text-zinc-500">
                {new Date(c.created_at).toLocaleString('cs-CZ')}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{c.content}</div>
            </li>
          ))}
          {!comments.length && <li className="text-zinc-500">Zatím žádné komentáře.</li>}
        </ul>
      </div>
    </div>
  )
}