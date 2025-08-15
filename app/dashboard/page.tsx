"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", image_url: "" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false });
      setPosts(data || []);
    }
    load();
  }, [user]);

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!user) { setMsg("Přihlas se."); return; }
    const { data, error } = await supabase.from("posts").insert({
      title: form.title,
      excerpt: form.excerpt || null,
      content: form.content || null,
      image_url: form.image_url || null,
      author_id: user.id,
      is_published: false
    }).select("*").single();
    if (error) setMsg(error.message);
    else {
      setMsg("Uloženo – čeká na schválení.");
      setPosts([data, ...posts]);
      setForm({ title: "", excerpt: "", content: "", image_url: "" });
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Nový článek</h2>
        <form onSubmit={createPost} className="space-y-3">
          <input className="w-full border rounded-md p-2" placeholder="Titulek" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="w-full border rounded-md p-2" placeholder="Krátký výtah (optional)" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          <textarea className="w-full border rounded-md p-2" rows={6} placeholder="Obsah (volitelné)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <input className="w-full border rounded-md p-2" placeholder="URL obrázku (nebo použij /api/upload)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <button className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">Uložit návrh</button>
          {msg && <p className="text-sm mt-2">{msg}</p>}
        </form>
      </section>
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Moje články</h2>
        <ul className="space-y-2">
          {posts.map(p => (
            <li key={p.id} className="border rounded-md p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">{p.is_published ? "Publikováno" : "Čeká na schválení"}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
