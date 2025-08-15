"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // necháme nové uživatele projít
        // captchaToken: "...", // pokud přidáš Turnstile i sem
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email", // důležité: email OTP
      // captchaToken: "...", // pokud použiješ Turnstile
    });
    setLoading(false);
    if (error) setError(error.message);
    else if (data?.session) router.replace("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-semibold mb-4">Přihlášení</h1>

      {!sent ? (
        <form onSubmit={sendCode} className="space-y-3">
          <input
            type="email"
            placeholder="tvuj@email.cz"
            className="w-full border rounded-md p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
            disabled={loading}
          >
            Poslat kód
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-gray-600">
            Poslali jsme 6místný kód na <b>{email}</b>. Zadej ho níže:
          </p>
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
            Přihlásit
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-xs text-gray-500 underline"
          >
            Zadat jiný e-mail
          </button>
        </form>
      )}
    </div>
  );
}
