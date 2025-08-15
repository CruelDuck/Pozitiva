// app/u/[username]/page.tsx
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export default async function UserPublic({
  params,
}: {
  params: { username: string };
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // načti veřejný profil podle username
  const { data: user, error: userErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, website_url")
    .eq("username", params.username)
    .maybeSingle();

  if (userErr) {
    console.error("profiles error:", userErr);
  }
  if (!user) {
    return notFound();
  }

  // poslední publikované články autora
  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, title, published_at")
    .eq("author_id", user.id)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(20);

  if (postsErr) {
    console.error("posts error:", postsErr);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-start gap-4 bg-white border rounded-xl p-4">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover border"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-gray-200 border" />
        )}
        <div>
          <h1 className="text-xl font-semibold">
            {user.display_name || user.username}
          </h1>
          {user.bio && <p className="text-sm text-gray-600">{user.bio}</p>}
          {user.website_url && (
            <a
              href={user.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
            >
              {user.website_url}
            </a>
          )}
        </div>
      </div>

      {posts && posts.length > 0 && (
        <div className="mt-6 bg-white border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Články</h2>
          <ul className="space-y-1">
            {posts.map((p: any) => (
              <li key={p.id} className="text-sm">
                <a href={`/p/${p.id}`} className="underline">
                  {p.title}
                </a>
                {p.published_at && (
                  <span className="text-xs text-gray-400">
                    {" "}
                    — {new Date(p.published_at).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}