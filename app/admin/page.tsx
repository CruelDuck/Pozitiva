"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminOnly from "@/components/AdminOnly";

type PostRow = {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  author_id: string | null;
  created_at: string | null;
  published_at: string | null;
  is_published: boolean | null;
  image_url: string | null;
  views: number | null;
};

type Author = { id: string; display_name: string | null };

function computeStatus(p: PostRow): "published" | "draft" {
  return p.is_published ? "published" : "draft";
}

export default function AdminPage() {
  return (
    <AdminOnly>
      <AdminInner />
    </AdminOnly>
  );
}

function AdminInner() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PostRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"waiting" | "published" | "all">("waiting");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      const SELECT =
        "id,title,slug,excerpt,author_id,created_at,published_at,is_published,image_url,views";

      const tryOrders = ["published_at", "created_at", "id"];
      let data: PostRow[] | null = null;
      let lastError: any = null;

      for (const col of tryOrders) {
        const r = await supabase
          .from("posts")
          .select(SELECT)
          .order(col as any, { ascending: false })
          .limit(200);
        if (!r.error && r.data) {
          data = r.data as PostRow[];
          lastError = null;
          break;
        } else {
          lastError = r.error;
        }
      }
      if (!data) {
        const r = await supabase.from("posts").select(SELECT).limit(200);
        if (!r.error && r.data) data = r.data as PostRow[];
      }
      if (!data) {
        if (!cancelled)
          setErr(String(lastError?.message || "Nepodařilo se načíst příspěvky."));
        setLoading(false);
        return;
      }

      // auto-detekce autorů
      const ids = Array.from(
        new Set(data.map((p) => p.author_id).filter(Boolean) as string[])
      );
      let names: Record<string, string> = {};
      if (ids.length) {
        const r = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", ids);
        if (!r.error && r.data) {
          (r.data as Author[]).forEach((a) => {
            names[a.id] = a.display_name || a.id.slice(0, 8);
          });
        }
      }

      if (!cancelled) {
        setRows(data);
        setAuthors(names);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let arr = rows.slice();
    if (tab === "waiting") arr = arr.filter((p) => !p.is_published);
    if (tab === "published") arr = arr.filter((p) => !!p.is_published);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(s) ||
          (p.excerpt || "").toLowerCase().includes(s) ||
          (p.slug || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [rows, tab, q]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    const SELECT =
      "id,title,slug,excerpt,author_id,created_at,published_at,is_published,image_url,views";
    const r = await supabase.from("posts").select(SELECT).limit(200);
    if (r.error || !r.data) {
      setErr(String(r.error?.message || "Načtení selhalo."));
      setLoading(false);
      return;
    }
    setRows(r.data as PostRow[]);
    setLoading(false);
  }

  async function setPublished(id: string, to: boolean) {
    const payload: Partial<PostRow> = {
      is_published: to,
      published_at: to ? new Date().toISOString() : null,
    };
    const r = await supabase.from("posts").update(payload).eq("id", id);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    refresh();
  }

  async function deletePost(id: string) {
    const r = await supabase.from("posts").delete().eq("id", id);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    refresh();
  }

  function statusBadge(p: PostRow) {
    const st = computeStatus(p);
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs border";
    if (st === "published")
      return (
        <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
          Publikováno
        </span>
      );
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
        Koncept
      </span>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Administrace článků
          </h1>
          <p className="text-gray-600 mt-1">
            Publikuj nové příspěvky, upravuj a sleduj zobrazení.
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/admin/comments"
            className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50"
          >
            Komentáře →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-white overflow-hidden">
          <button
            onClick={() => setTab("waiting")}
            className={`px-3 py-1.5 text-sm ${
              tab === "waiting" ? "bg-gray-900 text-white" : ""
            }`}
          >
            Čekající
          </button>
          <button
            onClick={() => setTab("published")}
            className={`px-3 py-1.5 text-sm ${
              tab === "published" ? "bg-gray-900 text-white" : ""
            }`}
          >
            Publikované
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 text-sm ${
              tab === "all" ? "bg-gray-900 text-white" : ""
            }`}
          >
            Vše
          </button>
        </div>

        <input
          className="ml-auto w-full sm:w-64 border rounded-lg px-3 py-2 text-sm"
          placeholder="Hledat v názvu/perexu…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          onClick={refresh}
          className="px-3 py-2 text-sm rounded-lg border bg-white"
        >
          Načíst znovu
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="overflow-x-auto border rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-[40%]">Název</th>
              <th className="text-left font-medium px-3 py-2">Autor</th>
              <th className="text-left font-medium px-3 py-2">Stav</th>
              <th className="text-left font-medium px-3 py-2">Publikováno</th>
              <th className="text-left font-medium px-3 py-2">Zobrazení</th>
              <th className="text-left font-medium px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4" colSpan={6}>
                  Načítám…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4" colSpan={6}>
                  Nic k zobrazení.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const link = `/p/${p.slug || p.id}`;
                const author =
                  (p.author_id && authors[p.author_id]) ||
                  (p.author_id ? p.author_id.slice(0, 8) : "—");
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium">
                        {p.title || "Bez názvu"}
                      </div>
                      {p.excerpt ? (
                        <div className="text-gray-600 line-clamp-2">
                          {p.excerpt}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">{author}</td>
                    <td className="px-3 py-3 align-top">{statusBadge(p)}</td>
                    <td className="px-3 py-3 align-top">
                      {p.published_at
                        ? new Date(p.published_at).toLocaleString("cs-CZ")
                        : "—"}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {typeof p.views === "number" ? p.views : 0}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 border rounded hover:bg-gray-50"
                        >
                          Náhled
                        </a>
                        <Link
                          href={`/dashboard/edit/${p.id}`}
                          className="px-2 py-1 border rounded hover:bg-gray-50"
                        >
                          Upravit
                        </Link>
                        {!p.is_published ? (
                          <button
                            onClick={() => setPublished(p.id, true)}
                            className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                          >
                            Publikovat
                          </button>
                        ) : (
                          <button
                            onClick={() => setPublished(p.id, false)}
                            className="px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                          >
                            Vrátit do konceptu
                          </button>
                        )}
                        <button
                          onClick={() => deletePost(p.id)}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Smazat
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
