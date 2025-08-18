"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminOnly from "@/components/AdminOnly";

type PostRow = {
  id: string;
  title: string | null;
  slug: string | null;
  summary?: string | null;
  author_id?: string | null;
  published_at?: string | null;
  status?: string | null;        // "draft" | "published" | ...
  is_published?: boolean | null; // true/false
  source_name?: string | null;
  source_url?: string | null;
  cover_url?: string | null;
};

type Author = { id: string; display_name: string | null };

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://pozitiva.vercel.app";

function computeStatus(p: PostRow): "published" | "draft" | "other" {
  if (p.is_published === true) return "published";
  if (p.status === "published") return "published";
  if (p.status === "draft" || p.is_published === false) return "draft";
  return "other";
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
  const [tab, setTab] = useState<"waiting" | "published" | "all">("waiting"); // výchozí „čekající“

  // načtení seznamu
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);

      const select =
        "id,title,slug,summary,author_id,published_at,status,is_published,source_name,source_url,cover_url";

      // pokus s order podle různých sloupců (schéma může být různé)
      const tryOrders = ["published_at", "updated_at", "created_at", "id"];
      let data: PostRow[] | null = null;
      let lastError: any = null;

      for (const col of tryOrders) {
        const r = await supabase
          .from("posts")
          .select(select)
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
        const r = await supabase.from("posts").select(select).limit(200);
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
    if (tab === "waiting")
      arr = arr.filter((p) => computeStatus(p) !== "published");
    if (tab === "published")
      arr = arr.filter((p) => computeStatus(p) === "published");
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(s) ||
          (p.summary || "").toLowerCase().includes(s) ||
          (p.slug || "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [rows, tab, q]);

  async function refresh() {
    // jednoduchá varianta – znovu spustíme efekt načtení:
    // (líně – vyvoláme změnu stavu, aby useEffect proběhl znova)
    // zde pro jednoduchost zopakujeme kód z načtení…
    setLoading(true);
    setErr(null);

    const select =
      "id,title,slug,summary,author_id,published_at,status,is_published,source_name,source_url,cover_url";
    const r = await supabase.from("posts").select(select).limit(200);
    if (r.error || !r.data) {
      setErr(String(r.error?.message || "Načtení selhalo."));
      setLoading(false);
      return;
    }
    setRows(r.data as PostRow[]);
    setLoading(false);
  }

  // robustní publikace / zrušení publikace / skrytí
  async function setPublished(id: string, to: boolean) {
    // publikace: nejdřív zkus status='published', pak is_published=true
    const now = to ? new Date().toISOString() : null;

    let r = await supabase
      .from("posts")
      .update({ status: to ? "published" : "draft", published_at: now })
      .eq("id", id);
    if (!r.error) return refresh();

    r = await supabase
      .from("posts")
      .update({ is_published: to, published_at: now })
      .eq("id", id);
    if (!r.error) return refresh();

    setErr(r.error?.message || "Nepodařilo se změnit stav.");
  }

  async function hideOrDelete(id: string) {
    // preferuj „skrytí“, když to schema dovolí; jinak smaž
    let r = await supabase.from("posts").update({ status: "hidden" }).eq("id", id);
    if (!r.error) return refresh();

    r = await supabase.from("posts").update({ is_hidden: true }).eq("id", id);
    if (!r.error) return refresh();

    r = await supabase.from("posts").delete().eq("id", id);
    if (!r.error) return refresh();

    setErr(r.error?.message || "Nepodařilo se skrýt/smazat příspěvek.");
  }

  function statusBadge(p: PostRow) {
    const st = computeStatus(p);
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs border";
    if (st === "published")
      return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Publikováno</span>;
    if (st === "draft")
      return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>Koncept</span>;
    return <span className={`${base} bg-gray-50 text-gray-600 border-gray-200`}>Neznámý</span>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schvalování článků</h1>
        <p className="text-gray-600 mt-1">
          Zde najdeš nové příspěvky, které čekají na publikaci. Otevři náhled, případně uprav
          a klikni na <b>Publikovat</b>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-white overflow-hidden">
          <button
            onClick={() => setTab("waiting")}
            className={`px-3 py-1.5 text-sm ${tab === "waiting" ? "bg-gray-900 text-white" : ""}`}
          >
            Čekající
          </button>
          <button
            onClick={() => setTab("published")}
            className={`px-3 py-1.5 text-sm ${tab === "published" ? "bg-gray-900 text-white" : ""}`}
          >
            Publikované
          </button>
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 text-sm ${tab === "all" ? "bg-gray-900 text-white" : ""}`}
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
              <th className="text-left font-medium px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-4" colSpan={5}>Načítám…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-4" colSpan={5}>Nic k zobrazení.</td></tr>
            ) : (
              filtered.map((p) => {
                const st = computeStatus(p);
                const link = `/zprava/${p.slug || p.id}`;
                const author =
                  (p.author_id && authors[p.author_id]) ||
                  (p.author_id ? p.author_id.slice(0, 8) : "—");
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium">{p.title || "Bez názvu"}</div>
                      {p.summary ? (
                        <div className="text-gray-600 line-clamp-2">{p.summary}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-gray-500 break-all">
                        {p.source_name ? `${p.source_name} · ` : ""}
                        {p.source_url ? (
                          <a href={p.source_url} target="_blank" rel="noreferrer" className="underline">
                            {p.source_url}
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">{author}</td>
                    <td className="px-3 py-3 align-top">{statusBadge(p)}</td>
                    <td className="px-3 py-3 align-top">
                      {p.published_at
                        ? new Date(p.published_at).toLocaleString("cs-CZ")
                        : "—"}
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
                        {st !== "published" ? (
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
                          onClick={() => hideOrDelete(p.id)}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Skrýt / smazat
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

      <p className="text-xs text-gray-500">
        Pozn.: „Publikovat“ zkusí nejprve <code>status='published'</code>, pak
        <code> is_published=true</code>. „Vrátit do konceptu“ obráceně. „Skrýt / smazat“
        zkusí <code>status='hidden'</code>, pak <code>is_hidden=true</code>, a nakonec mazání řádku.
      </p>
    </div>
  );
}