"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    turnstile: any;
  }
}

export default function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    // load script once
    if (typeof window === "undefined") return;

    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      setWidgetReady(true);
    };
    document.body.appendChild(s);
    return () => {
      document.body.removeChild(s);
    };
  }, []);

  useEffect(() => {
    if (!widgetReady || !widgetRef.current || !siteKey || !window.turnstile) return;
    // render the widget
    widgetIdRef.current = window.turnstile.render(widgetRef.current, {
      sitekey: siteKey,
      callback: (t: string) => setToken(t),
      "error-callback": () => setToken(null),
      "expired-callback": () => setToken(null),
      theme: "light",
    });
  }, [widgetReady, siteKey]);

  async function submit() {
    if (!user) {
      alert("Pro přidání komentáře se přihlaste.");
      return;
    }
    if (!body.trim()) return;

    // ensure we have a token
    if (!token && window.turnstile && widgetIdRef.current) {
      const t = window.turnstile.getResponse(widgetIdRef.current);
      if (t) setToken(t);
    }
    if (!token) {
      alert("Ověření nebylo dokončeno (Turnstile). Počkej chvilku a zkus to znovu.");
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          postId,
          body,
          parentId: parentId || null,
          turnstileToken: token,
        }),
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || "Nepodařilo se odeslat komentář");

      setBody("");
      setToken(null);
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!siteKey) {
    return <p className="text-sm text-red-600">Chybí konfigurace Turnstile (NEXT_PUBLIC_TURNSTILE_SITE_KEY).</p>;
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
        <div ref={widgetRef} />
        <button
          onClick={submit}
          disabled={loading || !token}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
          title={!token ? "Dokonči ověření (Turnstile)" : "Odeslat"}
        >
          Odeslat
        </button>
      </div>
    </div>
  );
}
