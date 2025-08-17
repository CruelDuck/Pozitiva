"use client";
import Link from "next/link";
import { useAuth } from "@/components/Auth";

export default function Header() {
  const { status } = useAuth();

  return (
    <header className="w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          Pozitiva
        </Link>

        {status === "checking" ? (
          <nav className="invisible"><span /></nav>
        ) : status === "authed" ? (
          <nav className="flex gap-5 text-sm">
            <Link href="/dashboard/new" className="hover:underline">Nový článek</Link>
            <Link href="/profile" className="hover:underline">Profil</Link>
            <Link href="/admin" className="hover:underline">Admin</Link>
            <Link href="/logout" className="font-medium text-white bg-black px-3 py-1.5 rounded-md">
              Odhlásit
            </Link>
          </nav>
        ) : (
          <nav className="flex gap-4 text-sm">
            <Link href="/login" className="font-medium hover:underline">Přihlásit</Link>
            <Link href="/register" className="hover:underline">Registrace</Link>
          </nav>
        )}
      </div>
    </header>
  );
}