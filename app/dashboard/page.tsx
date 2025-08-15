"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Source = { title: string; url: string };

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", image_url: "" });
  const [sources, setSources] = useState<Source[]>([{ title: "", url: "" }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });
      setPosts(data || []);
    }
    load();
  }, [user]);

  function addSourceField() {
    setSources((s) => [...s, { title: "", url: "" }]);
  }
  function setSource(i: number, key: "title" | "url", val: string) {
    setSources((s) => s.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  }
  function removeSource(i: number) {
    setSources((s) => s.filter((_, idx) => idx !== i));
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!user) {
      setMsg("Přihlas se.");
      return;
    }
    if (!form.title.trim()) {
      setMsg("Vyplň titulek.");
      return;
    }

    setSaving(true);
    try {
      // 1) Uložit samotný článek jako draft
      const { data: post, error } = await supabase
        .from("posts")
        .insert({
          title: form.title,
          excerpt: form.excerpt || null,
          content: form.content || null,
          image_url: form.image_url || null,
          author_id: user.id,
          is_published: false,
        })
        .select("*")
        .single();

      if (error || !post) throw new Error(error?.message || "Chyba uložení článku");

      // 2) Uložit zdroje (necháme jen ty s vyplněným URL)
      const toInsert = sources
        .filter((s) => s.url.trim())
        .map((s) => ({ post_id: post.id, title: s.title || null, url: s.url.trim() }));

      if (toInsert.length) {
        const { error: srcErr } = await supabase.from("post_sources").insert(toInsert);
        if (srcErr) throw srcErr;
      }

      setMsg("Uloženo – čeká na schválení.");
      setPosts([post, ...posts]);
      setForm({ title: "", excerpt: "", content: "", image_url: "" });
      setSources([{ title: "", url: "" }]);
    } catch (err: any) {
      setMsg(err.message || "Něco se pokazilo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Nový článek</h2>
        <form onSubmit={createPost} className="space-y-3">
          <input
            className="w-full border rounded-md p-2"
            placeholder="Titulek"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="w-full border rounded-md p-2"
            placeholder="Krátký výtah (volitelné)"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          />
          <textarea
            className="w-full border rounded-md p-2"
            rows={6}
            placeholder="Obsah (volitelné)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <input
            className="w-full border rounded-md p-2"
            placeholder="URL obrázku (nebo použij /api/upload)"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />

          {/* Zdroje */}
          <div className="pt-3 border-t">
            <h3 className="font-medium mb-2">Zdroje</h3>
            <div className="space-y-2">
              {sources.map((s, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input
                    className="border rounded-md p-2 md:col-span-2"
                    placeholder="Název (volitelné)"
                    value={s.title}
                    onChange={(e) => setSource(i, "title", e.target.value)}
                  />
                  <input
                    className="border rounded-md p-2 md:col-span-3"
                    placeholder="URL (povinné, pokud chcete uložit zdroj)"
                    value={s.url}
                    onChange={(e) => setSource(i, "url", e.target.value)}
                  />
                  {sources.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-600 underline"
                      onClick={() => removeSource(i)}
                    >
                      Odebrat
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addSourceField} className="text-sm underline">
                Přidat další zdroj
              </button>
            </div>
          </div>

          <button
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
            disabled={saving}
          >
            Uložit návrh
          </button>
          {msg && <p className="text-sm mt-2">{msg}</p>}
        </form>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Moje články</h2>
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="border rounded-md p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">
                {p.is_published ? "Publikováno" : "Čeká na schválení"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
