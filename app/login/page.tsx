"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

type Phase = "checking" | "logged" | "ask" | "verify";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>("checking");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const timedOut = useRef(false);
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setWho(session.user.email || null);
        setPhase("logged");
      }
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setWho(data.session.user.email || null);
        setPhase("logged");
      } else {
        setPhase("ask");
      }
    })();
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setHint(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      });
      if (error) throw error;
      setPhase("verify");
    } catch (e: any) {
      setErr(e?.message || "Nepodarilo se odeslat kod.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setHint(null);
    setLoading(true);
    timedOut.current = false;
    const t = setTimeout(() => {
      timedOut.current = true;
      setHint("Overeni trva dele. Zkuste kliknout na odkaz v e-mailu ve stejnem prohlizeci, nebo poslat kod znovu.");
      setLoading(false);
    }, 10000);

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      clearTimeout(t);
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setWho(data.session.user.email || null);
        setPhase("logged");
      } else {
        setHint("Kod prosiel, cekam na session... Kdyz to visi, pouzijte odkaz v e-mailu.");
      }
    } catch (e: any) {
      clearTimeout(t);
      if (!timedOut.current) setErr(e?.message || "Kod je neplatny nebo expiroval.");
      setLoading(false);
    }
  }

  async function resend() {
    setErr(null);
    setHint(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || "Nepodarilo se znovu odeslat kod.");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "checking") return <div className="max-w-md mx-auto p-6">Nacitam...</div>;

  if (phase === "logged") {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Jste prihlasen</h1>
        <div className="text-gray-700">{who ? `Uzivatel: ${who}` : null}</div>
        <div className="flex gap-2">
          <button onClick={() => router.replace("/dashboard")} className="px-4 py-2 rounded bg-black text-white">
            Prejit na dashboard
          </button>
          <a href="/logout" className="px-4 py-2 rounded border inline-flex items-center">
            Odhlasit
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Prihlaseni</h1>

      {phase === "ask" && (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block">
            <span className="text-sm text-gray-600">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="tvoje@adresa.cz"
            />
          </label>

          {err && <div className="text-sm text-red-600">{err}</div>}
          {hint && <div className="text-sm text-amber-700">{hint}</div>}

          <button type="submit" disabled={loading} className="w-full bg-black text-white rounded px-4 py-2">
            {loading ? "Posilam..." : "Poslat prihlasovaci kod"}
          </button>

          <p className="text-xs text-gray-500">
            Odkaz z e-mailu otevri ve stejnem prohlizeci, nebo pouzij 6mistny kod.
          </p>
        </form>
      )}

      {phase === "verify" && (
        <form onSubmit={verifyCode} className="space-y-3">
          <div className="text-sm text-gray-700">Kod jsme poslali na <b>{email}</b>.</div>

          <label className="block">
            <span className="text-sm text-gray-600">Kod z e-mailu</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full border rounded px-3 py-2 tracking-widest text-center"
              placeholder="123456"
            />
          </label>

          {err && <div className="text-sm text-red-600">{err}</div>}
          {hint && <div className="text-sm text-amber-700">{hint}</div>}

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white rounded px-4 py-2">
              {loading ? "Overuji..." : "Overit kod"}
            </button>
            <button type="button" onClick={() => setPhase("ask")} className="px-4 py-2 rounded border">
              Zmenit e-mail
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={resend} disabled={loading} className="underline">Poslat kod znovu</button>
            <span className="text-gray-500">•</span>
            <a href={`${SITE_URL}/auth/callback`} className="underline">Dokoncit pres odkaz v e-mailu</a>
          </div>
        </form>
      )}
    </div>
  );
}