"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("reader");
  const [pending, setPending] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        setRole(prof?.role || "reader");
      }
    });
  }, []);

  useEffect(() => {
    async function load() {
      const { data: posts } = await supabase.from("posts").select("*").eq("is_published", false).order("created_at", { ascending: false });
      setPending(posts || []);
      const { data: com } = await supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(20);
      setComments(com || []);
    }
    load();
  }, [user]);

  async function publish(id: string) {
    await supabase.from("posts").update({ is_published: true, published_at: new Date().toISOString() }).eq("id", id);
    setPending(prev => prev.filter(p => p.id !== id));
  }

  async function hideComment(id: string) {
    await supabase.from("comments").update({ is_hidden: true }).eq("id", id);
    setComments(prev => prev.map(c => c.id === id ? { ...c, is_hidden: true } : c));
  }

  if (!user) return <div>Přihlaste se.</div>;
  if (role !== "admin") return <div>Nemáte oprávnění (admin only).</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Ke schválení</h2>
        <ul className="space-y-2">
          {pending.map(p => (
            <li key={p.id} className="border rounded-md p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString()}</div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => publish(p.id)} className="px-2 py-1 text-sm rounded bg-brand-600 text-white">Publikovat</button>
              </div>
            </li>
          ))}
          {pending.length === 0 && <p>Nic nečeká.</p>}
        </ul>
      </section>
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Poslední komentáře</h2>
        <ul className="space-y-2">
          {comments.map(c => (
            <li key={c.id} className="border rounded-md p-3">
              <div className="text-sm">{c.body}</div>
              <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
              <div className="mt-2">
                {!c.is_hidden && <button onClick={() => hideComment(c.id)} className="px-2 py-1 text-sm rounded bg-gray-800 text-white">Skrýt</button>}
                {c.is_hidden && <span className="text-xs text-red-600">Skrytý</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
