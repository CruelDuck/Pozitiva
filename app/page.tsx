import { FACTS } from "@/data/facts";
import ArticleCard from "@/components/ArticleCard";
import { createClient } from "@supabase/supabase-js";

type Post = {
  id: string;
  title: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
};

async function getNameday(): Promise<string> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/nameday`, { cache: "no-store" });
    if (!res.ok) throw new Error("Nameday API error");
    const data = await res.json();
    return data?.nameday || "Hezký den";
  } catch {
    return "Hezký den";
  }
}

async function getFeaturedPost(): Promise<Post | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("posts")
    .select("id, title, excerpt, image_url, published_at")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(1);
  return (data && data[0]) || null;
}

async function getLatest(): Promise<Post[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("posts")
    .select("id, title, excerpt, image_url, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(12);
  return (data as any) || [];
}

export default async function HomePage() {
  const [nameday, featured, latest] = await Promise.all([getNameday(), getFeaturedPost(), getLatest()]);
  const fact = FACTS[Math.floor(Math.random() * FACTS.length)];

  return (
    <div className="space-y-8">
      {/* Pozitivní dnešek */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-brand-600 mb-1">Dnes má svátek</h3>
          <p className="text-lg">{nameday}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-brand-600 mb-1">Hezký fakt</h3>
          <p>{fact}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-brand-600 mb-1">Mini-zpráva</h3>
          {featured ? (
            <div>
              <p className="font-medium">{featured.title}</p>
              {featured.excerpt ? <p className="text-sm text-gray-600">{featured.excerpt}</p> : null}
            </div>
          ) : <p className="text-sm text-gray-600">Zatím žádné zprávy – přidej první v Dashboardu.</p>}
        </div>
      </section>

      {/* Feed */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Nejnovější pozitivní zprávy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {latest.map((p) => <ArticleCard key={p.id} article={p} />)}
        </div>
      </section>
    </div>
  );
}
