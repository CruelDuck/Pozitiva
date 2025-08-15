"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    })();
  }, [router]);
  return (
    <div className="max-w-md mx-auto p-6">
      Odhlašuji…
    </div>
  );
}