"use client";
import { useEffect, useState } from "react";
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
      <NewPostInner />
    </AuthOnly>
  );
}

function NewPostInner() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMsg(null); setErr(null);
  }, [title, sourceUrl, content]);

  async function save() {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    setErr(null);

    const payloadBase: any = {
      title: title || "Bez nazvu",
      content: content || "",
      author_id: user.id,
    };
    if (sourceUrl) payloadBase.source_url = sourceUrl;
    const slug = slugify(title || "");
    if (slug) payloadBase.slug = slug;

    // pokus 1: se "status: draft"
    let { error: e1 } = await supabase.from("posts").insert({ ...payloadBase, status: "draft" });
    if (e1) {
      // pokus 2: bez status, ale s is_published=false
      const { error: e2 } = await supabase.from("posts").insert({ ...payloadBase, is_published: false });
      if (e2) {
        setErr(e2.message || e1.message || "Ulozeni selhalo.");
        setSaving(false);
        return;
      }
    }

    setMsg("Ulozeno jako koncept. Dekujeme!");
    setSaving(false);
    setTimeout(() => router.replace("/dashboard"), 800);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novy clanek</h1>

      <label className="block">
        <div className="text-sm text-gray-600">Titulek</div>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nadpis clanku"
        />
      </label>

      <label className="block">
        <div className="text-sm text-gray-600">Zdroj (URL, volitelne)</div>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          inputMode="url"
        />
      </label>

      <label className="block">
        <div className="text-sm text-gray-600">Obsah</div>
        <textarea
          className="mt-1 w-full border rounded px-3 py-2 min-h-[200px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Napis pozitivni zpravu..."
        />
      </label>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {msg && <div className="text-sm text-green-700">{msg}</div>}

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded bg-black text-white"
      >
        {saving ? "Ukladam..." : "Ulozit jako koncept"}
      </button>
    </div>
  );
}