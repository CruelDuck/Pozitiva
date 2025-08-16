import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function generateDraft() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const supabase = createClient(url, anon);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, title, summary, slug, published_at, source_url")
    .eq("is_published", true)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(12);

  if (postsErr) {
    return NextResponse.json({ ok: false, error: postsErr.message }, { status: 400 });
  }

  const list = posts ?? [];
  const date = new Date().toLocaleDateString("cs-CZ");
  const subject = `Pozitiva – výběr dne (${date})`;

  const itemsHtml =
    list
      .map(
        (p) => `
    <tr><td style="padding:12px 0;border-top:1px solid #eee">
      <a href="${site}/p/${p.slug || p.id}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${p.title}</a>
      ${p.summary ? `<div style="font-size:13px;color:#555;margin-top:4px">${p.summary}</div>` : ""}
      ${p.source_url ? `<div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="${p.source_url}">${p.source_url}</a></div>` : ""}
    </td></tr>`
      )
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

  const { error } = await supabase
    .from("newsletter_issues")
    .insert({ subject, html, text: "", status: "draft" });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, count: list.length });
}

// GET: volá Vercel Cron (x-vercel-cron) nebo ručně s ?secret=...
export async function GET(req: Request) {
  const fromCron = !!req.headers.get("x-vercel-cron");
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!fromCron && secret !== process.env.CRON_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return generateDraft();
}

// POST: manuální spuštění z admin UI s ověřením role admin
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: me } = await userClient.auth.getUser();
  if (!me?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: prof } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", me.user.id)
    .single();

  if (prof?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  return generateDraft();
}