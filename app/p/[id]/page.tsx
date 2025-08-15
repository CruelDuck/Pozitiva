import { createClient } from "@supabase/supabase-js";
import CommentList from "@/components/CommentList";
import dynamic from "next/dynamic";

const CommentForm = dynamic(() => import("@/components/CommentForm"), { ssr: false });

export default async function PostDetail({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: post } = await supabase.from("posts").select("*").eq("id", params.id).single();
  if (!post || !post.is_published) return <div className="py-10">Příspěvek nenalezen.</div>;

  const [{ data: author }, { data: sources }, { data: cats }] = await Promise.all([
    supabase.from("profiles").select("display_name, username, avatar_url, bio, website_url").eq("id", post.author_id).maybeSingle(),
    supabase.from("post_sources").select("title, url").eq("post_id", post.id).order("id", { ascending: true }),
    supabase.from("post_categories").select("category_id, categories(name)").eq("post_id", post.id),
  ]);

  const catNames = (cats || []).map((c: any) => c.categories?.name).filter(Boolean);

  return (
    <div className="prose max-w-none">
      <h1>{post.title}</h1>
      {post.image_url ? <img src={post.image_url} alt={post.title} className="rounded-lg" /> : null}
      {post.excerpt ? <p className="text-lg">{post.excerpt}</p> : null}
      {post.content ? <div className="mt-4 whitespace-pre-wrap">{post.content}</div> : null}

      {/* Autor + Kategorie */}
      <div className="not-prose mt-6 grid gap-4 sm:grid-cols-2">
        {author && (
          <div className="p-4 border rounded-xl bg-white">
            <div className="flex items-start gap-3">
              {author.avatar_url && <img src={author.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <div>
                <div className="font-semibold">{author.display_name || author.username || "Autor"}</div>
                {author.bio && <div className="text-sm text-gray-600">{author.bio}</div>}
                {author.website_url && (
                  <a href={author.website_url} target="_blank" rel="noopener noreferrer" className="text-sm underline text-brand-600">
                    {author.website_url}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        {catNames.length > 0 && (
          <div className="p-4 border rounded-xl bg-white">
            <h4 className="font-semibold mb-2">Kategorie</h4>
            <div className="flex flex-wrap gap-2">
              {catNames.map((n: string, i: number) => (
                <span key={i} className="px-2 py-1 text-xs rounded-full border bg-gray-50">{n}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zdroje */}
      {sources && sources.length > 0 && (
        <div className="mt-6 not-prose">
          <h4 className="font-semibold mb-2">Zdroje</h4>
          <ul className="list-disc pl-5 space-y-1">
            {sources.map((s: any, i: number) => (
              <li key={i}>
                <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 not-prose">
        <CommentForm postId={post.id} />
        <CommentList postId={post.id} />
      </div>
    </div>
  );
}
