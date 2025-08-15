"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!sent || cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sent, cooldown]);

  async function sendCode() {
    setErr(null);
    setLoading(true);
    const tryOnce = () =>
      supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
    // jednoduchý retry na síťový výpadek
    let error = null;
    for (let i = 0; i < 2; i++) {
      const { error: e } = await tryOnce();
      if (!e) {
        error = null;
        break;
      }
      error = e;
      await new Promise((r) => setTimeout(r, 600));
    }
    setLoading(false);
    if (error) setErr(error.message);
    else {
      setSent(true);
      setCooldown(30);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) return setErr(error.message);
    if (data?.session) router.replace("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-semibold mb-4">Přihlášení</h1>

      {!sent ? (
        <div className="space-y-3">
          <input
            type="email"
            placeholder="tvuj@email.cz"
            className="w-full border rounded-md p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            onClick={sendCode}
            disabled={loading || !email}
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? "Posílám…" : "Poslat kód"}
          </button>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <p className="text-xs text-gray-500">Kód dorazí e-mailem (zkontroluj i spam).</p>
          <p className="text-xs text-gray-500">
            Nemáš účet? <a href="/register" className="underline">Registruj se</a>.
          </p>
        </div>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-gray-600">Kód jsme poslali na <b>{email}</b>.</p>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            className="w-full tracking-widest text-center text-xl border rounded-md p-3"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <button
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
            disabled={loading || code.length !== 6}
          >
            {loading ? "Ověřuji…" : "Přihlásit"}
          </button>
          <div className="text-xs text-gray-500">
            Nepřišel kód?{" "}
            <button
              type="button"
              onClick={sendCode}
              disabled={cooldown > 0 || loading}
              className="underline disabled:no-underline disabled:opacity-50"
              aria-disabled={cooldown > 0}
              title={cooldown > 0 ? `Počkej ${cooldown}s` : "Znovu poslat kód"}
            >
              Znovu poslat{cooldown > 0 ? ` (${cooldown}s)` : ""}
            </button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="button"
            onClick={() => { setSent(false); setCode(""); }}
            className="text-xs text-gray-500 underline"
          >
            Zadat jiný e-mail
          </button>
        </form>
      )}
    </div>
  );
}