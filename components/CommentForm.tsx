"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global { interface Window { turnstile?: any } }

type Suggest = { id:string; username:string|null; display_name:string|null; avatar_url:string|null };

export default function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [user, setUser] = useState<any>(null);

  // mentions
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggests, setSuggests] = useState<Suggest[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement|null>(null);

  // CAPTCHA
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const widgetHostRef = useRef<HTMLDivElement|null>(null);
  const widgetIdRef = useRef<any>(null);
  const [token, setToken] = useState<string|null>(null);

  useEffect(() => { supabase.auth.getUser().then(({data}) => setUser(data.user)); }, []);

  // Programatické renderování Turnstile (bez spolehnutí na auto-render)
  useEffect(() => {
    if (!siteKey) { setToken("dev"); return; } // DEV fallback bez CAPTCHA
    let cancelled = false;

    // počkáme, než je skript připraven
    function tryRender(attempt = 0) {
      if (cancelled) return;
      if (typeof window !== "undefined" && window.turnstile && widgetHostRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
            sitekey: siteKey,
            callback: (t: string) => setToken(t),
            "expired-callback": () => setToken(null),
            "error-callback": () => setToken(null),
          });
        } catch (e) {
          // zkusíme to znovu
          if (attempt < 10) setTimeout(() => tryRender(attempt + 1), 300);
        }
      } else {
        if (attempt < 20) setTimeout(() => tryRender(attempt + 1), 300);
      }
    }

    tryRender();
    return () => { cancelled = true; };
  }, [siteKey]);

  async function onChange(val: string) {
    setBody(val);
    const caret = textareaRef.current?.selectionStart ?? val.length;
    const uptoCaret = val.slice(0, caret);
    const m = uptoCaret.match(/(^|\s)@([a-zA-Z0-9_]{1,30})$/);
    if (m) {
      const q = m[2].toLowerCase();
      const { data } = await supabase.from("profiles")
        .select("id,username,display_name,avatar_url")
        .ilike("username", q + "%").limit(5);
      setSuggestOpen(true);
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
    const m = uptoCaret.match(/(^|\s)@([a-zA-Z0-9_]{1,30})$/);
    if (!m) return;
    const start = caret - m[2].length - 1;
    const before = val.slice(0, start);
    const after = val.slice(caret);
    const username = s.username || "";
    const inserted = `@${username} `;
    const next = before + inserted + after;
    setBody(next);
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
    setError(null);
    if (!user) { setError("Přihlašte se."); return; }
    if (!body.trim()) { setError("Napište komentář."); return; }

    if (siteKey && !token) { setError("Dokončete ověření (CAPTCHA)."); return; }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token || "";
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ postId, content: body, parentId: parentId || null, turnstileToken: token }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setError(out?.error || "Nepodařilo se odeslat komentář."); return; }

      setBody("");
      setToken(siteKey ? null : "dev");
      try { window.turnstile?.reset(widgetIdRef.current); } catch {}
    } catch (e:any) {
      setError(e.message || "Chyba při odesílání.");
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
        {/* host element pro programatické renderování */}
        {siteKey ? (
          <div ref={widgetHostRef} />
        ) : (
          <div className="text-xs text-zinc-500">CAPTCHA vypnutá (DEV).</div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
        >
          Odeslat
        </button>
      </div>

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}
