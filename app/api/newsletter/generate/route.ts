import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Udela kratky vytah z HTML bez slozitych regexu
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
  return text.length > max ? text.slice(0, max - 1) + "..." : text;
}

// Zkusi ruzne kombinace sloupcu pro datum a stav; kdyz nic, vezme fallback
async function safeFetchPosts(sb: any, sinceISO: string) {
  const orderCols = ["published_at", "created_at"];
  const filters: Array<{ field?: string; value?: any; tag: string }> = [
    { field: "is_published", value: true, tag: "is_published" },
    { field: "status", value: "published", tag: "status" },
    { tag: "nofilter" },
  ];

  for (const orderCol of orderCols) {
    for (const f of filters) {
      try {
        let q = sb.from("posts").select("*").order(orderCol as any, { ascending: false }).limit(12);
        q = q.gte(orderCol as any, sinceISO);
        if (f.field) q = q.eq(f.field as any, f.value);
        const { data, error } = await q;
        if (!error) {
          return { data: data ?? [], used: { orderCol, filter: f.tag } };
        }
      } catch (_) {
        // ignoruj a zkus dalsi variantu
      }
    }
  }

  // Posledni fallback: bez filtru i bez gte
  const fallbacks = ["created_at", "published_at", "id"];
  for (const col of fallbacks) {
    const { data, error } = await sb.from("posts").select("*").order(col as any, { ascending: false }).limit(12);
    if (!error) {
      return { data: data ?? [], used: { orderCol: col, filter: "fallback" } };
    }
  }

  return { data: [], used: { orderCol: "none", filter: "none" } };
}

async function generateDraft() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!url || !service) {
    return NextResponse.json(
      { ok: false, step: "env_check", missing: { NEXT_PUBLIC_SUPABASE_URL: !url, SUPABASE_SERVICE_ROLE: !service } },
      { status: 500 }
    );
  }

  const admin = createClient(url, service);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const fetched = await safeFetchPosts(admin, since);
  const posts = fetched.data || [];
  const used = fetched.used;

  const date = new Date().toLocaleDateString("cs-CZ");
  const subject = "Pozitiva - vyber dne (" + date + ")";

  let itemsHtml = "";
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i] as any;
    const summary = makeExcerpt(p.content || "");
    const link = site + "/p/" + (p.slug || p.id);
    let src = "";
    if (p.source_url) {
      src =
        '<div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="' +
        p.source_url +
        '">' +
        p.source_url +
        "</a></div>";
    }
    itemsHtml +=
      '<tr><td style="padding:12px 0;border-top:1px solid #eee">' +
      '<a href="' +
      link +
      '" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">' +
      (p.title || "Bez nazvu") +
      "</a>" +
      (summary ? '<div style="font-size:13px;color:#555;margin-top:4px">' + summary + "</div>" : "") +
      src +
      "</td></tr>";
  }
  if (!itemsHtml) {
    itemsHtml = "<tr><td>Za poslednich 24h nemame nove clanky.</td></tr>";
  }

  const html =
    '<div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
    '<h1 style="margin:0 0 12px">Pozitiva - prehled dne</h1>' +
    '<div style="color:#666;font-size:13px;margin-bottom:16px">' +
    date +
    "</div>" +
    '<table width="100%" cellpadding="0" cellspacing="0">' +
    itemsHtml +
    "</table>" +
    '<div style="font-size:12px;color:#888;margin-top:24px">' +
    "Tento e-mail jste obdrzeli na zaklade souhlasu. " +
    '<a href="' +
    site +
    '/api/newsletter/unsubscribe?token={{TOKEN}}">Odhlasit odber</a>' +
    "</div>" +
    "</div>";

  const { error: insErr } = await admin
    .from("newsletter_issues")
    .insert({ subject: subject, html: html, text: "", status: "draft" });

  if (insErr) {
    return NextResponse.json({ ok: false, step: "insert_issue", error: insErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, count: posts.length, used });
}

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

export async function POST() {
  return generateDraft();
}