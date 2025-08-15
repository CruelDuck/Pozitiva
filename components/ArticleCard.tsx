import Link from "next/link";

export type Article = {
  id: string;
  title: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
};

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="border rounded-xl p-4 bg-white hover:shadow-sm transition">
      {article.image_url ? (
        <div className="mb-3">
          {/* Using img instead of next/image to avoid remote config */}
          <img src={article.image_url} alt={article.title} className="w-full h-48 object-cover rounded-lg" />
        </div>
      ) : null}
      <h3 className="text-lg font-semibold mb-1">
        <Link href={`/p/${article.id}`}>{article.title}</Link>
      </h3>
      {article.excerpt ? <p className="text-gray-600 text-sm">{article.excerpt}</p> : null}
      {article.published_at ? <p className="text-xs text-gray-400 mt-2">Publikováno: {new Date(article.published_at).toLocaleDateString()}</p> : null}
    </article>
  );
}
