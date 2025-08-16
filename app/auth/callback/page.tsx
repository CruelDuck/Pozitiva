"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Zpracovávám přihlášení…");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg("Nepodařilo se dokončit přihlášení: " + error.message);
          return;
        }
        setMsg("Hotovo. Přesměrovávám…");
        router.replace("/dashboard");
      } catch (e: any) {
        setMsg("Chyba: " + String(e?.message || e));
      }
    })();
  }, [router]);

  return <div className="max-w-md mx-auto p-6">{msg}</div>;
}