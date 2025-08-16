import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  // jednoduché ověření cronu
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // posts za posledních 24h (lokálně pro Prahu – přibližně)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, summary, slug, published_at, source_url")
    .eq("is_published", true)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(12);

  const list = posts || [];
  const date = new Date().toLocaleDateString("cs-CZ");
  const subject = `Pozitiva – výběr dne (${date})`;

  const itemsHtml = list.map(p => `
    <tr><td style="padding:12px 0;border-top:1px solid #eee">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/p/${p.slug || p.id}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${p.title}</a>
      ${p.summary ? `<div style="font-size:13px;color:#555;margin-top:4px">${p.summary}</div>` : ""}
      ${p.source_url ? `<div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="${p.source_url}">${p.source_url}</a></div>` : ""}
    </td></tr>
  `).join("") || `<tr><td>Za posledních 24h nemáme nové články.</td></tr>`;

  const html = `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h1 style="margin:0 0 12px">Pozitiva – přehled dne</h1>
    <div style="color:#666;font-size:13px;margin-bottom:16px">${date}</div>
    <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
    <div style="font-size:12px;color:#888;margin-top:24px">
      Tento e-mail jste obdrželi na základě souhlasu. 
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/newsletter/unsubscribe?token={{TOKEN}}">Odhlásit odběr</a>
    </div>
  </div>`.trim();

  const { error } = await supabase
    .from("newsletter_issues")
    .insert({ subject, html, text: "", status: "draft" });

  if (error) return new NextResponse(error.message, { status: 400 });
  return NextResponse.json({ ok: true, count: list.length });
}