"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

type Comment = {
  id: string;
  body: string;
  user_id: string;
  parent_id: string | null;
  created_at: string;
  is_hidden: boolean;
};

function nest(comments: Comment[]) {
  const byId: Record<string, any> = {};
  comments.forEach(c => byId[c.id] = { ...c, children: [] });
  const roots: any[] = [];
  comments.forEach(c => {
    if (c.parent_id && byId[c.parent_id]) {
      byId[c.parent_id].children.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });
  return roots;
}

export default function CommentList({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("comments")
        .select("id, body, user_id, parent_id, created_at, is_hidden")
        .eq("post_id", postId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (mounted && data) setComments(data as any);
    }
    load();

    const channel = supabase.channel("comments-" + postId)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setComments(prev => [...prev, payload.new as any]);
        }
        if (payload.eventType === "UPDATE") {
          setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new as any : c));
        }
        if (payload.eventType === "DELETE") {
          setComments(prev => prev.filter(c => c.id !== (payload.old as any).id));
        }
      })
      .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
  }, [postId]);

  const tree = useMemo(() => nest(comments), [comments]);

  const Item = ({ node, level = 0 }: any) => (
    <div style={{ marginLeft: level * 16 }} className="mb-3">
      <div className="rounded-md border p-2 bg-white">
        <p className="text-sm">{node.body}</p>
        <p className="text-xs text-gray-400 mt-1">{new Date(node.created_at).toLocaleString()}</p>
      </div>
      {node.children?.map((child: any) => <Item key={child.id} node={child} level={level + 1} />)}
    </div>
  );

  return (
    <div className="mt-6">
      <h4 className="font-semibold mb-2">Komentáře</h4>
      {tree.length === 0 ? <p className="text-sm text-gray-500">Buď první, kdo přidá komentář.</p> : tree.map((n: any) => <Item key={n.id} node={n} />)}
    </div>
  );
}
