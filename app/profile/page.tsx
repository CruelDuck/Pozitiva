"use client";
import { useEffect, useState } from "react";
import { AuthOnly, useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, bio, website")
        .eq("id", user.id)
        .single();
      if (error && error.code !== "PGRST116") {
        setErr(error.message);
      } else {
        setP(
          data || {
            id: user.id,
            display_name: user.email?.split("@")[0] || "",
            bio: "",
            website: "",
          }
        );
      }
    })();
  }, [user?.id, user?.email]);

  async function save() {
    if (!p) return;
    setSaving(true);
    setMsg(null);
    setErr(null);
    const { error } = await supabase.from("profiles").upsert({
      id: p.id,
      display_name: p.display_name,
      bio: p.bio,
      website: p.website,
    });
    if (error) setErr(error.message);
    else setMsg("Profil ulozen.");
    setSaving(false);
  }

  if (!p) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Muj profil</h1>

      <label className="block">
        <div className="text-sm text-gray-600">Zobrazovane jmeno</div>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={p.display_name || ""}
          onChange={(e) => setP({ ...p, display_name: e.target.value })}
        />
      </label>

      <label className="block">
        <div className="text-sm text-gray-600">Web (volitelne)</div>
        <input
          className="mt-1 w-full border rounded px-3 py-2"
          value={p.website || ""}
          onChange={(e) => setP({ ...p, website: e.target.value })}
          placeholder="https://..."
          inputMode="url"
        />
      </label>

      <label className="block">
        <div className="text-sm text-gray-600">Bio</div>
        <textarea
          className="mt-1 w-full border rounded px-3 py-2 min-h-[120px]"
          value={p.bio || ""}
          onChange={(e) => setP({ ...p, bio: e.target.value })}
          placeholder="Neco o tobe..."
        />
      </label>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {msg && <div className="text-sm text-green-700">{msg}</div>}

      <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-black text-white">
        {saving ? "Ukladam..." : "Ulozit profil"}
      </button>
    </div>
  );
}