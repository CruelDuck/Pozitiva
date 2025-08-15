import { createClient } from "@supabase/supabase-js";
import CommentList from "@/components/CommentList";
import dynamic from "next/dynamic";

const CommentForm = dynamic(() => import("@/components/CommentForm"), { ssr: false });

export default async function PostDetail({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("posts")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data || !data.is_published) {
    return <div className="py-10">Příspěvek nenalezen.</div>;
  }

  return (
    <div className="prose max-w-none">
      <h1>{data.title}</h1>
      {data.image_url ? <img src={data.image_url} alt={data.title} className="rounded-lg" /> : null}
      {data.excerpt ? <p className="text-lg">{data.excerpt}</p> : null}
      {data.content ? <div className="mt-4 whitespace-pre-wrap">{data.content}</div> : null}

      <div className="mt-8">
        <CommentForm postId={data.id} />
        <CommentList postId={data.id} />
      </div>
    </div>
  );
}
