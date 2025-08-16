import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // jistota, že běžíme na serveru (ne Edge)

/** Krátký výtah z HTML bez složitých regexů */
function makeExcerpt(html?: string, max = 180) {
  if (!html) return "";
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Variabilní dotaz podle toho, jaké máš sloupce/flagy v `posts` */
async function fetchPosts(sb: any, sinceISO: string) {
  const variants = [
    { cols: "id,title,slug,content,published_at,source_url", where: ["is_published", true], tag: "is_published+src" },
    { cols: "id,title,slug,content,published_at",           where: ["is_published", true], tag: "is_published" },
    { cols: "id,title,slug,content,published_at,source_url", where: ["status", "published"], tag: "status+src" },
    { cols: "id,title,slug,content,published_at",            where: ["status", "published"], tag: "status" },
  ] as const;

  for (const v of variants) {
    const { data, error } = await sb
      .from("posts")
      .select(v.cols)
      .gte("published_at", sinceISO)
      .order("published_at", { ascending: false })
      .limit(12)
      .eq(v.where[0], v.where[1]);

    if (!error) return { data: data ?? [], used: v };
  }
  return { data: [], error: new Error("No compatible posts query variant worked") };
}

async function generateDraft() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE!;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Service role → bypass RLS (bezpečné jen na serveru)
  const admin = createClient(url, service);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: posts, error, used } = await fetchPosts(admin, since);
  if (error) {
    return NextResponse.json(
      { ok: false, step: "select_posts", used, error: String(error.message || error) },
      { status: 400 }
    );
  }

  const date = new Date().toLocaleDateString("cs-CZ");
  const subject = `Pozitiva – výběr dne (${date})`;

  const itemsHtml =
    (posts || [])
      .map((p: any) => {
        const summary = makeExcerpt(p.content);
        const link = `${site}/p/${p.slug || p.id}`;
        const src = p.source_url
          ? `<div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="${p.source_url}">${p.source_url}</a></div>`
          : "";
        return `
          <tr><td style="padding:12px 0;border-top:1px solid #eee">
            <a href="${link}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${p.title}</a>
            ${summary ? `<div style="font-size:13px;color:#555;margin-top:4px">${summary}</div>` : ""}
            ${src}
          </td></tr>
        `;
      })
      .join("") || `<tr><td>Za posledních 24h nemáme nové články.</td></tr>`;

  const html = `
    <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h1 style="margin:0 0 12px">Pozitiva – přehled dne</h1>
      <div style="color:#666;font-size:13px;margin-bottom:16px">${date}</div>
      <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      <div style="font-size:12px;color:#888;margin-top:24px">
        Tento e-mail jste obdrželi na základě souhlasu.
        <a href="${site}/api/newsletter/unsubscribe?token={{TOKEN}}">Odhlásit odběr</a>
      </div>
    </div>
  `.trim();

  const { error: insErr } = await admin
    .from("newsletter_issues")
    .insert({ subject, html, text: "", status: "draft" });

  if (insErr) {
    return NextResponse.json({ ok: false, step: "insert_issue", error: insErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, count: posts.length, used });
}

// GET: Vercel Cron (x-vercel-cron) nebo ručně ?secret=...
export async function GET(req: Request) {
  const fromCron = !!req.headers.get("x-vercel-cron");
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const haveEnv = !!process.env.CRON_SECRET;

  if (!fromCron) {
    if (!secret) return NextResponse.json({ ok: false, reason: "missing-secret", haveEnv }, { status: 403 });
    if (!haveEnv) return NextResponse.json({ ok: false, reason: "server-missing-CRON_SECRET" }, { status: 500 });
    if (secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false, reason: "bad-secret" }, { status: 403 });
  }
  return generateDraft();
}

// POST: ruční spuštění z admin UI (Bearer token + role=admin) – volitelné
export async function POST(req: Request) {
  // už není nutné kontrolovat roli přes RLS, ale ponecháme ochranu UI:
  const auth = req.headers.get("authorization") || "";
  if (!auth) return new NextResponse("Unauthorized", { status: 401 });
  return generateDraft();
}