"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/Auth";

type State = "checking" | "allow" | "deny";

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const [state, setState] = useState<State>("checking");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (status === "checking") return;
      if (status === "anon" || !user?.id) {
        setState("deny");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!cancelled) {
        if (error || !data || data.role !== "admin") setState("deny");
        else setState("allow");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [status, user?.id]);

  useEffect(() => {
    if (state === "deny") router.replace("/"); // bez hlášky, prostě pryč
  }, [state, router]);

  if (state === "checking") return null;
  return state === "allow" ? <>{children}</> : null;
}