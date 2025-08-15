"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("reader");
  const [pending, setPending] = useState<any[]>([]);
  const [published, setPublished] = useState<any[]>([]);

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
      // drafty
      const { data: drafts } = await supabase
        .from("posts")
        .select("id, title, created_at")
        .eq("is_published", false)
        .order("created_at", { ascending: false });
      setPending(drafts || []);

      // publikované
      const { data: pubs } = await supabase
        .from("posts")
        .select("id, title, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(30);
      setPublished(pubs || []);
    }
    if (role === "admin") load();
  }, [role]);

  if (!user) return <div>Přihlaste se.</div>;
  if (role !== "admin") return <div>Nemáte oprávnění (admin only).</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Ke schválení</h2>
        <ul className="space-y-2">
          {pending.map((p) => (
            <li key={p.id} className="border rounded-md p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString()}</div>
              <div className="mt-2 flex gap-2">
                <Link href={`/admin/review/${p.id}`} className="px-2 py-1 text-sm rounded bg-brand-600 text-white">
                  Otevřít k recenzi
                </Link>
              </div>
            </li>
          ))}
          {pending.length === 0 && <p>Nic nečeká.</p>}
        </ul>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Publikované</h2>
        <ul className="space-y-2">
          {published.map((p) => (
            <li key={p.id} className="border rounded-md p-3">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs text-gray-500">{p.published_at ? new Date(p.published_at).toLocaleString() : "-"}</div>
              <div className="mt-2 flex gap-2">
                <Link href={`/admin/review/${p.id}`} className="px-2 py-1 text-sm rounded bg-gray-800 text-white">
                  Upravit
                </Link>
              </div>
            </li>
          ))}
          {published.length === 0 && <p>Nic zatím není.</p>}
        </ul>
      </section>
    </div>
  );
}
