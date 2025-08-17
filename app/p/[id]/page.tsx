'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
export default function PostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      const slug = params.id
      let p = null
      if (slug.length > 20) { const { data } = await supabase.from('posts').select('*').eq('id', slug).maybeSingle(); p = data }
      else { const { data } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle(); p = data }
      if (!p || !p.is_published) { setPost(undefined); return }
      setPost(p)
      const { data: srcs } = await supabase.from('post_sources').select('*').eq('post_id', p.id)
      setSources(srcs || [])
    })()
  }, [params.id])
  if (post === undefined) return <div>Příspěvek nenalezen.</div>
  if (!post) return <div>Načítám…</div>
  return (
    <div className="space-y-4">
      <article className="prose max-w-none">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        {post.excerpt && <p className="text-lg text-zinc-700">{post.excerpt}</p>}
        {post.image_url && <img src={post.image_url} alt="" className="w-full rounded-xl" />}
        <div className="whitespace-pre-wrap mt-4">{post.content}</div>
      </article>
      {!!sources.length && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Zdroje</h3>
          <ul className="list-disc pl-6">
            {sources.map((s:any) => <li key={s.id}><a href={s.url} className="link" target="_blank">{s.title || s.url}</a></li>)}
          </ul>
        </div>
      )}
      <div className="card p-4">
        <h3 className="font-semibold mb-2">Komentáře</h3>
        <p className="text-sm text-zinc-500">Formulář a seznam komentářů doplněny v /app/api/comments.</p>
      </div>
    </div>
  )
}
