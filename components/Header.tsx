"use client";
import Link from "next/link";
import { useAuth } from "@/components/Auth";

export default function Header() {
  const { status, user } = useAuth();

  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">Pozitiva</Link>

        {/* NAV podle auth stavu */}
        {status === "checking" ? (
          // Při načítání nerenderujeme nic konkrétního → bez blikání
          <nav className="invisible">
            <span />
          </nav>
        ) : status === "authed" ? (
          <nav className="flex gap-4">
            <Link href="/dashboard/new">Nový článek</Link>
            <Link href="/profile">Profil</Link>
            <Link href="/admin">Admin</Link>
            <Link href="/logout" className="font-medium">Odhlásit</Link>
          </nav>
        ) : (
          <nav className="flex gap-4">
            <Link href="/login" className="font-medium">Přihlásit</Link>
            <Link href="/register">Registrace</Link>
          </nav>
        )}
      </div>
    </header>
  );
}