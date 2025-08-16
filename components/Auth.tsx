"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthStatus = "checking" | "authed" | "anon";
type AuthCtx = {
  status: AuthStatus;
  user: any | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  status: "checking",
  user: null,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<any>(null);

  async function readSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setUser(data.session.user);
      setStatus("authed");
    } else {
      setUser(null);
      setStatus("anon");
    }
  }

  useEffect(() => {
    readSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setUser(session.user);
        setStatus("authed");
      } else {
        setUser(null);
        setStatus("anon");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={{ status, user, refresh: readSession }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

/** Vykreslí children jen pokud je uživatel přihlášen.
 *  Při "checking" nevykreslí nic (žádné „přihlaste se…“ → bez blikání).
 */
export function AuthOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { status } = useAuth();
  if (status === "checking") return null;
  return status === "authed" ? <>{children}</> : <>{fallback}</>;
}

/** Vykreslí children jen pro nepřihlášené (při "checking" nic). */
export function AnonOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { status } = useAuth();
  if (status === "checking") return null;
  return status === "anon" ? <>{children}</> : <>{fallback}</>;
}