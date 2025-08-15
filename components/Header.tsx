"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "reader" | "author" | "admin";
type Me =
  | {
      id: string;
      email?: string | null;
      role: Role;
      display_name?: string | null;
      username?: string | null;
      avatar_url?: string | null;
    }
  | null;

function NavLink({
  href,
  children,
  active,
  onClick,
  disabled,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const cls = [
    "px-2 py-1 rounded-md text-sm transition",
    active ? "bg-gray-100" : "hover:bg-gray-50",
    disabled ? "opacity-50 pointer-events-none" : "",
    className,
  ].join(" ");
  return (
    <Link href={href} onClick={onClick} className={cls}>
      {children}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        if (mounted) setMe(null);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, role, display_name, username, avatar_url")
        .eq("id", uid)
        .single();
      if (!mounted) return;
      if (prof) {
        setMe({
          id: (prof as any).id,
          email: (prof as any).email,
          role: ((prof as any).role as Role) || "author",
          display_name: (prof as any).display_name,
          username: (prof as any).username,
          avatar_url: (prof as any).avatar_url,
        });
      } else {
        setMe({ id: uid, role: "reader" });
      }
    }

    loadMe();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadMe());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  async function signOut() {
    await supabase.auth.signOut();
    setMe(null);
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-3 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white font-bold">
              P
            </span>
            <span className="font-semibold">Pozitiva</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/" active={isActive("/")}>
            Domů
          </NavLink>

          {me && (
            <NavLink href="/dashboard" active={isActive("/dashboard")}>
              Nový článek
            </NavLink>
          )}

          {me?.role === "admin" && (
            <NavLink href="/admin" active={isActive("/admin")}>
              Admin
            </NavLink>
          )}

          {!me && (
            <>
              <NavLink href="/register" active={isActive("/register")}>
                Registrace
              </NavLink>
              <NavLink href="/login" active={isActive("/login")}>
                Přihlášení
              </NavLink>
            </>
          )}

          {me && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-50"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                {me.avatar_url ? (
                  <img
                    src={me.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-gray-200 border" />
                )}
                <span className="text-sm">
                  {me.display_name || me.username || "Profil"}
                </span>
                <svg
                  className={`h-4 w-4 transition ${userMenuOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0l-4.24-4.24a.75.75 0 01.02-1.06z" />
                </svg>
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md border bg-white shadow-lg overflow-hidden"
                  role="menu"
                >
                  <Link
                    href="/profile"
                    className="block px-3 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    Profil
                  </Link>
                  <Link
                    href="/account/delete"
                    className="block px-3 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    Smazat účet
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    role="menuitem"
                  >
                    Odhlásit
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="md:hidden flex items-center gap-2">
          {!me ? (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-lg border text-sm"
              >
                Registrace
              </Link>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm"
              >
                Přihlášení
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md border"
              aria-label="Menu"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
              >
                <path strokeWidth="2" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {menuOpen && me && (
        <div className="md:hidden border-t bg-white">
          <div className="px-3 py-2 flex flex-col">
            <Link href="/" className="px-2 py-2 rounded-md hover:bg-gray-50">
              Domů
            </Link>
            <Link
              href="/dashboard"
              className="px-2 py-2 rounded-md hover:bg-gray-50"
            >
              Nový článek
            </Link>
            {me.role === "admin" && (
              <Link
                href="/admin"
                className="px-2 py-2 rounded-md hover:bg-gray-50"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="px-2 py-2 rounded-md hover:bg-gray-50"
            >
              Profil
            </Link>
            <Link
              href="/account/delete"
              className="px-2 py-2 rounded-md hover:bg-gray-50"
            >
              Smazat účet
            </Link>
            <button
              onClick={signOut}
              className="text-left px-2 py-2 rounded-md hover:bg-gray-50"
            >
              Odhlásit
            </button>
          </div>
        </div>
      )}
    </header>
  );
}