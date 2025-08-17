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
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [catsRaw, setCatsRaw] = useState("");

  const tags = useMemo(
    () => catsRaw.split(",").map((x) => x.trim()).filter(Boolean),
    [catsRaw]
  );

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setMsg(null); setWarn(null); setErr(null); }, [title, summary, content, sourceName, sourceUrl, coverUrl, catsRaw]);

  async function saveDraft() {
    if (!user?.id) return;
    setSaving(true);
    setMsg(null); setWarn(null); setErr(null);

    const base: any = {
      title: title || "Bez názvu",
      content: content || "",
      author_id: user.id,
      slug: slugify(title || ""),
      summary: summary || null,
      source_url: sourceUrl || null,
      source_name: sourceName || null,
      cover_url: coverUrl || null,
      tags: tags.length ? tags : null,
    };

    const insert = async (payload: any) =>
      supabase.from("posts").insert(payload).select("id").single();

    // A) status='draft'
    let { data, error } = await insert({ ...base, status: "draft" });

    // B) když ne, tak is_published=false
    if (error) ({ data, error } = await insert({ ...base, is_published: false }));

    // C) úplné minimum
    if (error) {
      const minimal = { title: base.title, content: base.content, author_id: base.author_id, slug: base.slug };
      ({ data, error } = await insert(minimal));
      if (!error) setWarn("Článek uložen, ale některá pole (perex, zdroj, obrázek, kategorie) se do schématu nevešla.");
    }

    if (error) {
      setErr(error.message || "Uložení selhalo.");
      setSaving(false);
      return;
    }

    setMsg("Uloženo jako koncept. Děkujeme!");
    setSaving(false);
    setTimeout(() => router.replace("/dashboard"), 700);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Nový článek</h1>
        <p className="text-gray-600 mt-1">Titulek, perex, obsah, zdroj a obrázek coveru. Kategorie odděl čárkou.</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 space-y-5">
        <label className="block">
          <div className="text-sm text-gray-700">Titulek</div>
          <input className="mt-1 w-full border rounded-lg px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nadpis článku" />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700">Perex (shrnutí)</div>
          <textarea className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Jedna až tři věty…" />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700">Obsah</div>
          <textarea className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[240px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Napište pozitivní zprávu…" />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-700">Název zdroje</div>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="např. ČTK, BBC, WHO…" />
          </label>

          <label className="block">
            <div className="text-sm text-gray-700">URL zdroje</div>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-700">Obrázek (URL coveru)</div>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…/image.jpg" inputMode="url" />
          </label>

          <label className="block">
            <div className="text-sm text-gray-700">Kategorie</div>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" value={catsRaw} onChange={(e) => setCatsRaw(e.target.value)} placeholder="Zdraví, Věda, Společnost…" />
          </label>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {warn && <div className="text-sm text-amber-700">{warn}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <div className="flex items-center gap-3">
          <button onClick={saveDraft} disabled={saving} className="px-4 py-2.5 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-60">
            {saving ? "Ukládám…" : "Uložit jako koncept"}
          </button>
          <span className="text-sm text-gray-500">Po uložení půjde článek schválit v administraci.</span>
        </div>
      </div>
    </div>
  );
}