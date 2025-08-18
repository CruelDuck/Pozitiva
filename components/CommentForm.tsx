"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global { interface Window { turnstile: any; } }

type Suggest = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

export default function CommentForm({ postId, parentId }: { postId: string; parentId?: string }) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // mentions
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [suggests, setSuggests] = useState<Suggest[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // captcha
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // DEV fallback – když není siteKey, necháme projít bez captcha (server ji stejně nevyžaduje, pokud není TURNSTILE_SECRET_KEY)
  const getCaptchaToken = (): string | null => {
    if (!siteKey) return "dev";
    const input = document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null;
    return input?.value || null;
  };

  async function onChange(val: string) {
    setBody(val);
    const caret = textareaRef.current?.selectionStart ?? val.length;
    const uptoCaret = val.slice(0, caret);
    const match = uptoCaret.match(/(^|\s)@([a-zA-Z0-9_]{1,30})$/);
    if (match) {
      const q = match[2].toLowerCase();
      setSuggestQuery(q);
      setSuggestOpen(true);
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
    const start = caret - match[2].length - 1;
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

    const turnstileToken = getCaptchaToken();
    if (siteKey && !turnstileToken) { setError("Dokončete ověření (CAPTCHA)."); return; }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token || "";
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ postId, content: body, parentId: parentId || null, turnstileToken }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setError(out?.error || "Nepodařilo se odeslat komentář."); return; }

      setBody("");
      // reset auto-render widgetu (pokud existuje)
      try { if (window.turnstile) window.turnstile.reset(); } catch {}
    } catch (e: any) {
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
        {/* Auto-render widget se sám zainicializuje skriptem v layoutu */}
        {siteKey ? (
          <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
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
