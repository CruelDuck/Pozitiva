"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        try { localStorage.removeItem("pozitiva.auth"); } catch {}
        window.location.href = "/";
      }
    })();
  }, []);
  return <div className="max-w-md mx-auto p-6">Odhlašuji...</div>;
}