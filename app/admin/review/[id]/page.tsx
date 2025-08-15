"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  author_id: string | null;
};
type Category = { id: number; name: string };
type Source = { id?: number; title: string | null; url: string };

export default function ReviewPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [role, setRole] = useState<string>("reader");
  const [post, setPost] = useState<Post | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [sources, setSources] = useState<Source[]>([{ title: null, url: "" }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setRole(prof?.role || "reader");
    });
  }, []);

  useEffect(() => {
    async function load() {
      // načti článek
      const { data: p } = await supabase.from("posts").select("*").eq("id", id).single();
      if (p) setPost(p as Post);

      // kategorie
      const { data: cats } = await supabase.from("categories").select("*").order("name");
      setCategories(cats || []);

      // vybrané kategorie
      const { data: pc } = await supabase
        .from("post_categories")
        .select("category_id")
        .eq("post_id", id);
      setSelectedCats((pc || []).map((r: any) => r.category_id));

      // zdroje
      const { data: src } = await supabase.from("post_sources").select("id, title, url").eq("post_id", id).order("id", { ascending: true });
      setSources((src as any) && (src as any).length ? (src as any) : [{ title: null, url: "" }]);
    }
    load();
  }, [id]);

  function toggleCat(cid: number) {
    setSelectedCats((prev) => (prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]));
  }

  function setSource(i: number, key: "title" | "url", val: string) {
    setSources((s) => s.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  }
  function addSource() {
    setSources((s) => [...s, { title: null, url: "" }]);
  }
  function removeSource(i: number) {
    setSources((s) => s.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!post) return;
    setSaving(true);
    setMsg(null);
    try {
      // 1) update post
      const { error: upErr } = await supabase
        .from("posts")
        .update({
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          image_url: post.image_url,
        })
        .eq("id", post.id);
      if (upErr) throw upErr;

      // 2) kategorie – smaž staré, vlož nové
      await supabase.from("post_categories").delete().eq("post_id", post.id);
      if (selectedCats.length) {
        await supabase.from("post_categories").insert(
          selectedCats.map((cid) => ({ post_id: post.id, category_id: cid }))
        );
      }

      // 3) zdroje – smaž vše a vlož aktuální (pro jednoduchost)
      await supabase.from("post_sources").delete().eq("post_id", post.id);
      const toInsert = sources.filter((s) => s.url && s.url.trim()).map((s) => ({
        post_id: post.id,
        title: s.title || null,
        url: s.url.trim(),
      }));
      if (toInsert.length) await supabase.from("post_sources").insert(toInsert);

      setMsg("Uloženo.");
    } catch (e: any) {
      setMsg(e.message || "Chyba ukládání");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!post) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", post.id);
      if (error) throw error;
      setPost({ ...post, is_published: true, published_at: new Date().toISOString() });
      setMsg("Publikováno.");
    } catch (e: any) {
      setMsg(e.message || "Chyba publikace");
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    if (!post) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_published: false })
        .eq("id", post.id);
      if (error) throw error;
      setPost({ ...post, is_published: false });
      setMsg("Odepublikováno.");
    } catch (e: any) {
      setMsg(e.message || "Chyba");
    } finally {
      setSaving(false);
    }
  }

  if (role !== "admin") return <div>Nemáte oprávnění.</div>;
  if (!post) return <div>Načítání…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="bg-white border rounded-xl p-4 lg:col-span-2">
        <h1 className="text-xl font-semibold mb-3">Recenze / Úpravy</h1>
        <div className="space-y-3">
          <input
            className="w-full border rounded-md p-2"
            value={post.title || ""}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
          />
          <input
            className="w-full border rounded-md p-2"
            placeholder="Krátký výtah"
            value={post.excerpt || ""}
            onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
          />
          <textarea
            className="w-full border rounded-md p-2"
            rows={12}
            placeholder="Obsah"
            value={post.content || ""}
            onChange={(e) => setPost({ ...post, content: e.target.value })}
          />
          <input
            className="w-full border rounded-md p-2"
            placeholder="URL obrázku"
            value={post.image_url || ""}
            onChange={(e) => setPost({ ...post, image_url: e.target.value })}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm">
            Uložit
          </button>
          {!post.is_published ? (
            <button onClick={publish} disabled={saving} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm">
              Publikovat
            </button>
          ) : (
            <button onClick={unpublish} disabled={saving} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm">
              Odepublikovat
            </button>
          )}
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </section>

      <aside className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-2">Kategorie</h3>
        <div className="space-y-1">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCats.includes(c.id)}
                onChange={() => toggleCat(c.id)}
              />
              {c.name}
            </label>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-500">Nejsou založené kategorie.</p>}
        </div>

        <h3 className="font-semibold mt-6 mb-2">Zdroje</h3>
        <div className="space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2">
              <input
                className="border rounded-md p-2"
                placeholder="Název (volitelné)"
                value={s.title || ""}
                onChange={(e) => setSource(i, "title", e.target.value)}
              />
              <input
                className="border rounded-md p-2"
                placeholder="URL"
                value={s.url}
                onChange={(e) => setSource(i, "url", e.target.value)}
              />
              {sources.length > 1 && (
                <button type="button" onClick={() => removeSource(i)} className="text-xs underline text-red-600">
                  Odebrat
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addSource} className="text-sm underline">
            Přidat zdroj
          </button>
        </div>
      </aside>
    </div>
  );
}
