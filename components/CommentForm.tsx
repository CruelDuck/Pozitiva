"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window { turnstile: any; }
}

type Suggest = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

export default function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // mentions state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [suggests, setSuggests] = useState<Suggest[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<any>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);

  // Turnstile loader
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      widgetIdRef.current = window.turnstile.render(widgetRef.current!, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "error-callback": () => setToken(null),
        "expired-callback": () => setToken(null),
      });
    };
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, [siteKey]);

  // změny textu + detekce '@'
  async function onChange(val: string) {
    setBody(val);
    const caret = textareaRef.current?.selectionStart ?? val.length;
    const uptoCaret = val.slice(0, caret);
    const match = uptoCaret.match(/(^|\s)@([a-zA-Z0-9_]{1,30})$/); // poslední token začínající @
    if (match) {
      const q = match[2].toLowerCase();
      setSuggestQuery(q);
      setSuggestOpen(true);
      // načteme návrhy uživatelů podle username prefixu
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", q + "%")
        .limit(5);
      setSuggests((data || []) as any);
      setActiveIndex(0);
    } else {
      setSuggestOpen(false);
      setSuggests([]);
    }
  }

  function insertMention(s: Suggest) {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const caret = el.selectionStart;
    const val = body;
    const uptoCaret = val.slice(0, caret);
    const match = uptoCaret.match(/(^|\s)@([a-zA-Z0-9_]{1,30})$/);
    if (!match) return;
    const start = caret - match[2].length - 1; // pozice '@'
    const before = val.slice(0, start);
    const after = val.slice(caret);
    const username = s.username || ""; // bez mezer
    const inserted = `@${username} `;
    const next = before + inserted + after;
    setBody(next);
    // posun kurzor
    requestAnimationFrame(() => {
      const pos = (before + inserted).length;
      el.setSelectionRange(pos, pos);
      el.focus();
    });
    setSuggestOpen(false);
    setSuggests([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestOpen || suggests.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % suggests.length); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex((i) => (i - 1 + suggests.length) % suggests.length); }
    if (e.key === "Enter")     { e.preventDefault(); insertMention(suggests[activeIndex]); }
    if (e.key === "Escape")    { setSuggestOpen(false); }
  }

  async function submit() {
    if (!user) return alert("Přihlašte se.");
    if (!body.trim()) return;

    if (!token && window.turnstile && widgetIdRef.current) {
      const t = window.turnstile.getResponse(widgetIdRef.current);
      if (t) setToken(t);
    }
    if (!token) return alert("Dokončete ověření (Turnstile).");

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token || ""}`,
        },
        body: JSON.stringify({ postId, body, parentId: parentId || null, turnstileToken: token }),
      });
      const out = await res.text();
      if (!res.ok) throw new Error(out || "Nepodařilo se odeslat komentář");

      setBody("");
      setToken(null);
      if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 relative">
      <textarea
        ref={textareaRef}
        className="w-full border rounded-md p-2 text-sm"
        rows={3}
        placeholder="Napiš milý komentář… (zmínka: napiš @uživatel)"
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />

      {/* návrhy na zmínky */}
      {suggestOpen && suggests.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-w-md bg-white border rounded-md shadow">
          {suggests.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => insertMention(s)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 ${i === activeIndex ? "bg-gray-50" : ""}`}
            >
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gray-200" />
              )}
              <div>
                <div className="text-sm font-medium">@{s.username}</div>
                {s.display_name && <div className="text-xs text-gray-500">{s.display_name}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

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