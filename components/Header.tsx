"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NavLink = ({ href, children }: any) => {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={clsx(
        "px-3 py-2 rounded-lg text-sm",
        active ? "bg-brand-50 text-brand-600" : "hover:bg-gray-100"
      )}
    >
      {children}
    </Link>
  );
};

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg">Pozitivní Zprávy</Link>
        <nav className="flex items-center gap-1">
  <NavLink href="/">Domů</NavLink>
  <NavLink href="/dashboard">Dashboard</NavLink>
  <NavLink href="/admin">Admin</NavLink>
  <NavLink href="/profile">Profil</NavLink>
  <NavLink href="/login">Přihlášení</NavLink>
        </nav>
      </div>
    </header>
  );
}
