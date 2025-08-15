"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    // Turnstile widget loader
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.body.appendChild(s);

    (window as any).onTurnstileSuccess = (t: string) => setToken(t);

    return () => { document.body.removeChild(s); };
  }, []);

  async function submit() {
    if (!user) {
      alert("Pro přidání komentáře se přihlaste.");
      return;
    }
    if (!body.trim()) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.data.session?.access_token || ""}`
        },
        body: JSON.stringify({
          postId,
          body,
          parentId: parentId || null,
          turnstileToken: token
        })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Nepodařilo se odeslat komentář");
      }
      setBody("");
      // Turnstile resets automatically after success
      setToken(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <textarea
        className="w-full border rounded-md p-2 text-sm"
        rows={3}
        placeholder="Napiš milý komentář..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        <div
          className="cf-turnstile"
          data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          data-callback="onTurnstileSuccess"
        />
        <button
          onClick={submit}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
        >
          Odeslat
        </button>
      </div>
    </div>
  );
}
