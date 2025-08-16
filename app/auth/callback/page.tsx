"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Zpracovavam prihlaseni...");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg("Nepodarilo se dokoncit prihlaseni: " + error.message);
          return;
        }
        setMsg("Hotovo. Presmerovavam...");
        router.replace("/dashboard");
      } catch (e: any) {
        setMsg("Chyba: " + String(e?.message || e));
      }
    })();
  }, [router]);

  return <div className="max-w-md mx-auto p-6">{msg}</div>;
}