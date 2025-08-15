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

function nest(comments: (Comment & { author?: Profile | null })[]) {
  const byId: Record<string, any> = {};
  comments.forEach((c) => (byId[c.id] = { ...c, children: [] }));
  const roots: any[] = [];
  comments.forEach((c) => {
    if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].children.push(byId[c.id]);
    else roots.push(byId[c.id]);
  });
  return roots;
}

export default function CommentList({ postId }: { postId: string }) {
  const [comments, setComments] = useState<(Comment & { author?: Profile | null })[]>([]);
  const [me, setMe] = useState<{ id: string; role: Profile["role"] } | null>(null);
  const [loading, setLoading] = useState(false);

  // kdo jsem + moje role
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

  // načtení komentářů + autorů
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data: rows } = await supabase
          .from("comments")
          .select("id, body, user_id, parent_id, created_at, is_hidden")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

        const list = (rows || []) as Comment[];

        // načti autory hromadně
        const uids = Array.from(new Set(list.map((c) => c.user_id)));
        let authorsMap: Record<string, Profile> = {};
        if (uids.length) {
          const { data: authors } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url, role")
            .in("id", uids as any);
          (authors || []).forEach((a: any) => (authorsMap[a.id] = a));
        }

        const withAuthors = list.map((c) => ({ ...c, author: authorsMap[c.user_id] || null }));
        if (mounted) setComments(withAuthors);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();

    // realtime
    const channel = supabase
      .channel("comments-" + postId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const c = payload.new as Comment;
            // dohledat autora
            const { data: a } = await supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url, role")
              .eq("id", c.user_id)
              .single();
            setComments((prev) => [...prev, { ...c, author: a || null }]);
          }
          if (payload.eventType === "UPDATE") {
            const c = payload.new as Comment;
            setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
          }
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as any).id;
            setComments((prev) => prev.filter((x) => x.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const tree = useMemo(() => nest(comments), [comments]);

  async function deleteComment(id: string) {
    if (!confirm("Opravdu smazat komentář?")) return;
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) alert(error.message);
  }

  async function hideComment(id: string) {
    const { error } = await supabase.from("comments").update({ is_hidden: true }).eq("id", id);
    if (error) alert(error.message);
  }

  const Item = ({ node, level = 0 }: any) => {
    const canDelete = me && (me.id === node.user_id || me.role === "admin");
    const canHide = me && me.role === "admin";
    const author = node.author as Profile | null;

    return (
      <div style={{ marginLeft: level * 16 }} className="mb-3">
        <div className="rounded-md border p-3 bg-white">
          <div className="flex items-start gap-2">
            {author?.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover border"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gray-100 border" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {author?.display_name || author?.username || "Uživatel"}
                </span>
                {author?.role === "admin" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-gray-50">
                    Admin
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(node.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm mt-1">{node.body}</p>

              {(canDelete || canHide) && (
                <div className="mt-2 flex gap-3">
                  {canDelete && (
                    <button
                      onClick={() => deleteComment(node.id)}
                      className="text-xs text-red-600 underline"
                    >
                      Smazat
                    </button>
                  )}
                  {canHide && !node.is_hidden && (
                    <button
                      onClick={() => hideComment(node.id)}
                      className="text-xs text-gray-600 underline"
                    >
                      Skrýt (admin)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {node.children?.map((child: any) => (
          <Item key={child.id} node={child} level={level + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="mt-6">
      <h4 className="font-semibold mb-2">Komentáře</h4>
      {loading && comments.length === 0 ? (
        <p className="text-sm text-gray-500">Načítám…</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-gray-500">Buď první, kdo přidá komentář.</p>
      ) : (
        tree.map((n: any) => <Item key={n.id} node={n} />)
      )}
    </div>
  );
}