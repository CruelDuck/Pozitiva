'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import CommentForm from '@/components/CommentForm'

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

type Comment = { id: number; content: string; created_at: string; user_id: string | null }

export default function PostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // načtení článku + komentáře
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setErr(null)
      const ident = params.id
      const byUuid = /^[0-9a-f-]{32,}$/i.test(ident)
      const sel =
        'id,title,slug,excerpt,content,image_url,image_credit,image_license,image_source_url,is_published,published_at,views'

      const q = supabase.from('posts').select(sel).limit(1)
      const { data: rows, error } = byUuid ? await q.eq('id', ident) : await q.eq('slug', ident)
      if (error || !rows?.length) { if (!cancelled){ setErr(error?.message || 'Příspěvek nenalezen.'); setLoading(false)}; return }
      const p = rows[0] as Post
      if (!p.is_published) { if (!cancelled){ setErr('Tento příspěvek není publikovaný.'); setLoading(false)}; return }
      if (!cancelled) setPost(p)

      // komentáře (nejdřív RPC – pokud není, fallback na SELECT)
      let cms: any[] = []
      const rpc = await supabase.rpc('list_comments_for_post', { pid: p.id })
      if (!rpc.error && rpc.data) {
        cms = rpc.data as any[]
      } else {
        const sel = await supabase
          .from('comments')
          .select('id,content,created_at,user_id')
          .eq('post_id', p.id)
          .order('created_at', { ascending: false })
        if (!sel.error && sel.data) cms = sel.data as any[]
      }
      if (!cancelled) setComments(cms)

      // zobrazení++
      try { await fetch('/api/posts/view', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ postId: p.id }) }) } catch {}

      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [params.id])

  const published = useMemo(() => {
    if (!post?.published_at) return null
    try { return new Date(post.published_at).toLocaleString('cs-CZ') } catch { return post.published_at }
  }, [post?.published_at])

  async function refreshComments() {
    if (!post) return
    // použij stejnou logiku jako výše
    const rpc = await supabase.rpc('list_comments_for_post', { pid: post.id })
    if (!rpc.error && rpc.data) { setComments(rpc.data as any[]); return }
    const sel = await supabase
      .from('comments')
      .select('id,content,created_at,user_id')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
    if (!sel.error && sel.data) setComments(sel.data as any[])
  }

  if (loading) return <div>Načítám…</div>
  if (err) return <div className="text-red-600">{err}</div>
  if (!post) return null

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-zinc-700">{post.excerpt}</p>}
        <div className="text-xs text-zinc-500">
          {published ? <>Publikováno: {published} · </> : null}
          {typeof post.views === 'number' ? <>Zobrazení: {post.views}</> : null}
        </div>
      </header>

      {post.image_url && (
        <figure>
          <img src={post.image_url} alt="" className="w-full rounded-xl" />
          {(post.image_credit || post.image_license || post.image_source_url) && (
            <figcaption className="text-xs text-zinc-500 mt-1">
              {post.image_credit && <span>© {post.image_credit}. </span>}
              {post.image_license && <span>Licence: {post.image_license}. </span>}
              {post.image_source_url && (
                <a className="underline" href={post.image_source_url} target="_blank" rel="noreferrer">Zdroj</a>
              )}
            </figcaption>
          )}
        </figure>
      )}

      {post.content && <article className="prose max-w-none whitespace-pre-wrap">{post.content}</article>}

      {/* KOMENTÁŘE */}
      <section className="card p-4 space-y-4">
        <h3 className="font-semibold">Komentáře</h3>

        <CommentForm postId={post.id} onSuccess={refreshComments} />

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
