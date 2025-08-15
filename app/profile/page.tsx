"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setUser(u);
      if (!u) return;
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id, email, display_name, first_name, last_name, username, bio, avatar_url, website_url"
        )
        .eq("id", u.id)
        .single();
      if (p) setProfile(p as any);
    });
  }, []);

  async function save() {
    if (!profile) return;
    setMsg(null);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name,
          first_name: profile.first_name,
          last_name: profile.last_name,
          username: profile.username,
          bio: profile.bio,
          website_url: profile.website_url,
          avatar_url: profile.avatar_url,
        })
        .eq("id", profile.id);
      if (error) throw error;
      setMsg("Profil uložen.");
    } catch (e: any) {
      setMsg(e.message || "Chyba ukládání");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(file: File) {
    try {
      const filename = `avatar-${user.id}-${Date.now()}.${(file.name.split(".").pop() || "jpg")}`;
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload selhal");
      const blob = await res.json();
      setProfile((p) => (p ? { ...p, avatar_url: blob.url } : p));
    } catch (e: any) {
      setMsg(e.message || "Upload selhal");
    }
  }

  if (!user) {
    return <div className="max-w-md mx-auto">Přihlaste se prosím.</div>;
  }
  if (!profile) {
    return <div className="max-w-md mx-auto">Načítání…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-semibold mb-4">Můj profil</h1>

      <div className="flex items-start gap-4">
        <div>
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 rounded-full object-cover border"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gray-100 border" />
          )}
        </div>
        <div>
          <label className="text-sm block mb-1">Změnit avatar</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && onAvatarChange(e.target.files[0])}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="text-sm">Zobrazované jméno</label>
          <input
            className="w-full border rounded-md p-2"
            value={profile.display_name || ""}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm">Uživatelské jméno</label>
          <input
            className="w-full border rounded-md p-2"
            value={profile.username || ""}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm">Jméno</label>
          <input
            className="w-full border rounded-md p-2"
            value={profile.first_name || ""}
            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm">Příjmení</label>
          <input
            className="w-full border rounded-md p-2"
            value={profile.last_name || ""}
            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm">Bio</label>
          <textarea
            rows={4}
            className="w-full border rounded-md p-2"
            value={profile.bio || ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm">Web</label>
          <input
            className="w-full border rounded-md p-2"
            placeholder="https://…"
            value={profile.website_url || ""}
            onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm">E-mail (neměnitelné)</label>
          <input className="w-full border rounded-md p-2 bg-gray-50" value={profile.email || ""} disabled />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
        >
          Uložit
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
