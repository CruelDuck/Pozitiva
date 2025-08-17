"use client";

import { useEffect, useState } from "react";
import { AuthOnly, useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  display_name?: string | null; // Přezdívka / zobrazované jméno
  full_name?: string | null;    // Jméno a příjmení (volitelné)
  username?: string | null;     // Veřejná URL /u/[username] (volitelné)
  bio?: string | null;          // Popis uživatele
  website?: string | null;      // Web
  avatar_url?: string | null;   // URL fotky
};

export default function ProfilePage() {
  return (
    <AuthOnly>
      <ProfileInner />
    </AuthOnly>
  );
}

function ProfileInner() {
  const { user } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Načtení profilu
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setMsg(null); setWarn(null); setErr(null);

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, username, bio, website, avatar_url")
        .eq("id", user.id)
        .single();

      // Když v tabulce není řádek, připrav default (nechybová situace)
      if (error && (error as any).code !== "PGRST116") {
        setErr(error.message || "Nepodařilo se načíst profil.");
        setLoading(false);
        return;
      }

      const defaultDisplay =
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Nový uživatel";

      setP(
        data || {
          id: user.id,
          display_name: defaultDisplay,
          full_name: user.user_metadata?.full_name || "",
          username: "",
          bio: "",
          website: "",
          avatar_url: user.user_metadata?.avatar_url || "",
        }
      );
      setLoading(false);
    })();
  }, [user?.id, user?.email, user?.user_metadata]);

  // Bezpečné uložení s fallbacky pro chybějící sloupce
  async function progressiveUpsert(profile: Profile) {
    // zkusíme plný payload → když DB vrátí "column ... does not exist",
    // budeme postupně odebírat volitelná pole
    const optionalFields: (keyof Profile)[] = [
      "username",
      "full_name",
      "avatar_url",
      "website",
      "bio",
      "display_name", // i to může v některých schématech chybět
    ];

    let removed: string[] = [];
    let payload: any = { ...profile };

    for (let i = -1; i < optionalFields.length; i++) {
      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (!error) {
        return { ok: true as const, removed };
      }

      // pokud je jiná chyba než "sloupec neexistuje", vrátíme ji rovnou
      const msg = String(error.message || error);
      if (!/column .* does not exist/i.test(msg) && !/missing .* column/i.test(msg)) {
        return { ok: false as const, error: msg, removed };
      }

      // odeber další volitelné pole a zkus znovu
      const key = optionalFields[i + 1];
      if (!key) return { ok: false as const, error: msg, removed };
      delete payload[key];
      removed.push(String(key));
    }

    return { ok: false as const, error: "Neznámá chyba při ukládání.", removed };
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    setMsg(null); setWarn(null); setErr(null);

    const { ok, error, removed } = await progressiveUpsert({
      id: p.id,
      display_name: (p.display_name || "").trim() || null,
      full_name: (p.full_name || "").trim() || null,
      username: (p.username || "").trim() || null,
      bio: (p.bio || "").trim() || null,
      website: (p.website || "").trim() || null,
      avatar_url: (p.avatar_url || "").trim() || null,
    });

    if (!ok) {
      setErr(error || "Uložení selhalo.");
      setSaving(false);
      return;
    }

    if (removed.length) {
      setWarn(
        `Profil uložen, ale následující pole ve schématu chybí: ${removed.join(
          ", "
        )}. Doplníme je později v DB.`
      );
    }
    setMsg("Profil uložen.");
    setSaving(false);
  }

  if (loading || !p) return null;

  const publicHandle = p.username?.trim() || user?.id;
  const publicUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://pozitiva.vercel.app") +
    `/u/${encodeURIComponent(publicHandle!)}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Můj profil</h1>
        <p className="text-gray-600 mt-1">
          Údaje o autorovi se zobrazí u článků a na veřejné profilové stránce.
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 space-y-6">
        {/* Avatar + náhled */}
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full border overflow-hidden bg-gray-100 shrink-0">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex-1">
            <label className="block">
              <div className="text-sm text-gray-700">URL fotky (avatar)</div>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="https://…/avatar.jpg"
                value={p.avatar_url || ""}
                onChange={(e) => setP({ ...p, avatar_url: e.target.value })}
                inputMode="url"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Zatím URL. Nahrávání přidáme přes Vercel Blob.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-700">Jméno a příjmení</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={p.full_name || ""}
              onChange={(e) => setP({ ...p, full_name: e.target.value })}
              placeholder="Jan Novák"
            />
          </label>

          <label className="block">
            <div className="text-sm text-gray-700">Přezdívka / zobrazované jméno</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={p.display_name || ""}
              onChange={(e) => setP({ ...p, display_name: e.target.value })}
              placeholder="Honza"
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-sm text-gray-700">Veřejné uživatelské jméno</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={p.username || ""}
              onChange={(e) => setP({ ...p, username: e.target.value })}
              placeholder="honza-novak"
            />
            <p className="text-xs text-gray-500 mt-1">
              Odkaz na profil: <span className="underline">{publicUrl}</span>
            </p>
          </label>

          <label className="block">
            <div className="text-sm text-gray-700">Web (volitelné)</div>
            <input
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={p.website || ""}
              onChange={(e) => setP({ ...p, website: e.target.value })}
              placeholder="https://…"
              inputMode="url"
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm text-gray-700">Bio / popis</div>
          <textarea
            className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[120px]"
            value={p.bio || ""}
            onChange={(e) => setP({ ...p, bio: e.target.value })}
            placeholder="Krátké představení, zájmy, co rád/a píšu…"
          />
        </label>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {warn && <div className="text-sm text-amber-700">{warn}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-black text-white hover:bg-black/90 disabled:opacity-60"
          >
            {saving ? "Ukládám…" : "Uložit profil"}
          </button>
        </div>
      </div>
    </div>
  );
}