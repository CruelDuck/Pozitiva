"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<"ask" | "verify">("ask");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace("/dashboard");
    })();
  }, [router]);

  async function sendSignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        options: {
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

  async function verifySignup(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup", // důležité: typ 'signup'
      });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Kód je neplatný nebo expiroval.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Registrace</h1>

      {phase === "ask" && (
        <form onSubmit={sendSignup} className="space-y-3">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded px-4 py-2"
          >
            {loading ? "Posílám…" : "Poslat registrační kód"}
          </button>

          <p className="text-xs text-gray-500">
            Když otevřeš e-mail v in-app prohlížeči (uvnitř e-mailové aplikace),
            přihlášení se nemusí propsat do hlavního prohlížeče. Proto je tu i
            možnost zadat 6místný kód ručně.
          </p>
        </form>
      )}

      {phase === "verify" && (
        <form onSubmit={verifySignup} className="space-y-3">
          <div className="text-sm text-gray-700">
            Na <b>{email}</b> jsme poslali 6místný kód. Zadej ho níže.
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

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white rounded px-4 py-2"
            >
              {loading ? "Ověřuji…" : "Ověřit kód"}
            </button>
            <button
              type="button"
              onClick={() => setPhase("ask")}
              className="px-4 py-2 rounded border"
            >
              Změnit e-mail
            </button>
          </div>

          <button
            type="button"
            onClick={sendSignup}
            className="text-sm text-gray-600 underline"
          >
            Poslat kód znovu
          </button>
        </form>
      )}
    </div>
  );
}