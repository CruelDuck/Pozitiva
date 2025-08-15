"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Comment = {
  id: string;
  body: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  is_hidden: boolean;
};

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role?: "reader" | "author" | "admin";
};

function nest(list: (Comment & { author?: Profile | null })[]) {
  const map: Record<string, any> = {};
  list.forEach((c) => (map[c.id] = { ...c, children: [] }));
  const roots: any[] = [];
  list.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
    else roots.push(map[c.id]);
  });
  return roots;
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      const u = p.slice(1);
      return (
        <a key={i} href={`/u/${u}`} className="underline">
          @{u}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function CommentList({ postId }: { postId: string }) {
  const [comments, setComments] = useState<(Comment & { author?: Profile | null })[]>([]);
  const [me, setMe] = useState<{ id: string; role: Profile["role"] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Kdo jsem + role
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return setMe(null);
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", uid)
        .single();
      setMe(prof ? { id: prof.id, role: (prof as any).role } : { id: uid, role: "reader" });
    })();
  }, []);

  // Načtení + autoři + realtime
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data: rows