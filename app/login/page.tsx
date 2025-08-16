"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<"ask" | "verify">("ask");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const timedOut = useRef(false);

  // když se session kdykoli objeví (třeba po kliknutí na e-mailový odkaz), přesměruj
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session) router.replace("/dashboard");
    });
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/dashboard");
    })();
    return () => sub.data.subscription.unsubscribe();
  }, [router]);

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
      setErr(e?.message || "Nepodařilo se odeslat kód.");
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

    // pojistka: po 10 s ukázat hint
    const t = setTimeout(() => {
      timedOut.current = true;
      setHint(
        "Ověření trvá déle než obvykle. Zkuste kliknout na odkaz v e-mailu (otevřete ho ve stejném prohlížeči), nebo kód pošlete a zadejte znovu."
      );
      setLoading(false);
    }, 10000);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      clearTimeout(t);
      if (error) throw error;

      // pro jistotu ověř, že máme session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setHint("Kód je ověřen, čekám na session… Pokud to visí, klikněte raději na odkaz v e-mailu.");
      }
    } catch (e: any) {
      clearTimeout(t);
      // pokud jsme už zobrazili hint kvůli timeoutu, nech ho — jinak ukaž chybu
      if (!timedOut.current) {
        setErr(e?.message || "Kód je neplatný nebo expiroval.");
      }
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
      setErr(e?.message || "Nepodařilo se znovu odeslat kód.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Přihlášení</h1>

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
            {loading ? "Posílám…" : "Poslat přihlašovací kód"}
          </button>

          <p className="text-xs text-gray-500">
            Tip: Pokud otevřete e-mail v in-app prohlížeči (uvnitř e-mailové aplikace),
            přihlášení se nemusí propsat do hlavního prohlížeče. Proto je tu i zadání 6místného kódu.
          </p>
        </form>
      )}

      {phase === "verify" && (
        <form onSubmit={verifyCode} className="space-y-3">
          <div className="text-sm text-gray-700">
            Kód jsme poslali na <b>{email}</b>.
          </div>

          <label className="block">
            <span className="text-sm text-gray-600">Kód z e-mailu</span>
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
              {loading ? "Ověřuji…" : "Ověřit kód"}
            </button>
            <button type="button" onClick={() => setPhase("ask")} className="px-4 py-2 rounded border">
              Změnit e-mail
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={resend} disabled={loading} className="underline">
              Poslat kód znovu
            </button>
            <span className="text-gray-500">•</span>
            <a href={`${SITE_URL}/auth/callback`} className="underline">
              Dokončit přes odkaz v e-mailu
            </a>
          </div>
        </form>
      )}
    </div>
  );
}