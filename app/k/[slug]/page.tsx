import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: cat } = await supabase
    .from("categories")
    .select("id, title, slug")
    .eq("slug", params.slug)
    .single();

  if (!cat) return <div className="max-w-6xl mx-auto px-3 py-6">Kategorie nenalezena.</div>;

  // články v kategorii (publikované)
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, summary, slug, published_at, author:profiles(display_name, username)")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .in("id",
      (await supabase.from("post_categories").select("post_id").eq("category_id", cat.id)).data?.map((r:any)=>r.post_id) || []
    );

  return (
    <div className="max-w-6xl mx-auto px-3 py-6">
      <h1 className="text-2xl font-semibold mb-4">{cat.title}</h1>
      {!posts?.length ? (
        <p>Zatím nic.</p>
      ) : (
        <ul className="space-y-3">
          {posts!.map((p:any) => (
            <li key={p.id} className="rounded-lg border bg-white p-4">
              <Link href={`/p/${p.slug || p.id}`} className="font-semibold underline">{p.title}</Link>
              {p.summary && <p className="text-sm text-gray-600 mt-1">{p.summary}</p>}
              <div className="text-xs text-gray-400 mt-1">
                {p.author?.display_name || p.author?.username || "Autor"} · {new Date(p.published_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}