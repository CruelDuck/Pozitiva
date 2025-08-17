"use client";
import { useEffect, useMemo, useState } from "react";
import { AuthOnly, useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export default function NewPostPage() {
  return (
    <AuthOnly>
      <NewPostForm />
    </AuthOnly>
  );
}

function NewPostForm() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [categoriesRaw, setCategoriesRaw] = useState("");
  const categories = useMemo(
    () =>
      categoriesRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    [categoriesRaw]
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMsg(null); setErr(null); setWarn(null);
  }, [title, summary, content, sourceUrl, categoriesRaw]);

  async function saveDraft() {
    if (!user?.id) return;
    setSaving(true);
    setMsg(null);
    setWarn(null);
    setErr(null);

    const base: any = {
      title: title || "Bez názvu",
      content: content || "",
      author_id: user.id,
    };
    const slug = slugify(title || "");
    if (slug) base.slug = slug;
    if (summary) base.summary = summary;
    if (sourceUrl) base.source_url = sourceUrl;

    // pokus A: status='draft' (+ tags když existují)
    let payloadA = { ...base, status: "draft" } as any;
    if (categories.length) payloadA.tags = categories;

    const tryInsert = async (payload: any) =>
      supabase.from("posts").insert(payload).select("id").single();

    // A
    let { data, error } = await tryInsert(payloadA);

    // B: bez status, ale is_published=false
    if (error) {
      let payloadB = { ...base, is_published: false } as any;
      if (categories.length) payloadB.tags = categories;
      ({ data, error } = await tryInsert(payloadB));
    }

    // C: minimální insert (bez summary/source_url/tags)
    if (error) {
      const payloadC = { title: base.title, content: base.content, author_id: base.author_id, slug: base.slug };
      ({ data, error } = await tryInsert(payloadC));
      if (!error && (summary || sourceUrl || categories.length)) {
        setWarn("Článek uložen, ale některá pole se do schématu nevešla (kategorie / perex / zdroj). Později je doplníme po úpravě DB.");
      }
    }

    if (error) {
      setErr(error.message || "Uložení selhalo.");
      setSaving(false);
      return;
    }

    setMsg("Uloženo jako koncept. Děkujeme!");
    setSaving(false);
    setTimeout(() => router.replace("/dashboard"), 800);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Nový článek</h1>
        <p className="text-gray-600 mt-1">
          Vyplňte titulek, krátký perex a hlavní text. Přidejte zdroj a kategorie pro lepší dohledatelnost.
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 space-y-5">
        <label className="block">
          <div className="text-sm text-gray-700">Titulek</div>
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nadpis článku"
          />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700">Perex (stručné shrnutí)</div>
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-black/10"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Jedna až tři věty pro náhled a newsletter."
          />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700">Obsah</div>
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[240px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-black/10"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Napište pozitivní zprávu…"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-700">Zdroj (URL)</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-700">Kategorie (oddělit čárkou)</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/10"
              value={categoriesRaw}
              onChange={(e) => setCategoriesRaw(e.target.value)}
              placeholder="Zdraví, Věda, Společnost…"
            />
          </label>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {warn && <div className="text-sm text-amber-700">{warn}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <div className="flex items-center gap-3">
          <button
            onClick={saveDraft}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-60"
          >
            {saving ? "Ukládám…" : "Uložit jako koncept"}
          </button>
          <span className="text-sm text-gray-500">
            Po uložení půjde článek schválit v administraci.
          </span>
        </div>
      </div>
    </div>
  );
}