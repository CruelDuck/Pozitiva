import { NextResponse } from "next/server"; import { createClient } from "@supabase/supabase-js";

function makeExcerpt(html?: string, max = 180) { if (!html) return ""; const text = html .replace(/<style[\s\S]?</style>/gi, " ") .replace(/<script[\s\S]?</script>/gi, " ") .replace(/<[^>]+>/g, " ") .replace(/ /g, " ") .replace(/\s+/g, " ") .trim(); return text.length > max ? text.slice(0, max - 1) + "…" : text; }

async function fetchPosts(supabase: ReturnType<typeof createClient>, sinceISO: string) { // 1) pokus s is_published + source_url let select = "id,title,slug,content,published_at,source_url"; let q = supabase .from("posts") .select(select) .gte("published_at", sinceISO) .order("published_at", { ascending: false }) .limit(12) .eq("is_published", true);

let { data, error } = await q; if (!error) return { data: data ?? [], used: { publishedBy: "is_published", select } };

// Pokud selže kvůli source_url, zkus bez něj if (String(error.message).includes("column posts.source_url")) { select = "id,title,slug,content,published_at"; const { data: d2, error: e2 } = await supabase .from("posts") .select(select) .gte("published_at", sinceISO) .order("published_at", { ascending: false }) .limit(12) .eq("is_published", true); if (!e2) return { data: d2 ?? [], used: { publishedBy: "is_published", select } }; }

// Pokud selže kvůli is_published, zkus status='published' if (String(error.message).includes("column posts.is_published")) { select = "id,title,slug,content,published_at,source_url"; let { data: d3, error: e3 } = await supabase .from("posts") .select(select) .gte("published_at", sinceISO) .order("published_at", { ascending: false }) .limit(12) .eq("status", "published");

if (e3 && String(e3.message).includes("column posts.source_url")) {
  select = "id,title,slug,content,published_at";
  const { data: d4, error: e4 } = await supabase
    .from("posts")
    .select(select)
    .gte("published_at", sinceISO)
    .order("published_at", { ascending: false })
    .limit(12)
    .eq("status", "published");
  if (!e4) return { data: d4 ?? [], used: { publishedBy: "status", select } };
  return { data: [], error: e4 };
}

if (!e3) return { data: d3 ?? [], used: { publishedBy: "status", select } };
return { data: [], error: e3 };

}

return { data: [], error }; }

async function generateDraft() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL!; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const supabase = createClient(url, anon);

const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); const { data: posts, error, used } = await fetchPosts(supabase, since); if (error) { return NextResponse.json( { ok: false, step: "select_posts", used, error: String(error.message || error) }, { status: 400 } ); }

const date = new Date().toLocaleDateString("cs-CZ"); const subject = Pozitiva – výběr dne (${date});

const itemsHtml = (posts || []) .map((p: any) => { const summary = makeExcerpt(p.content); const link = ${site}/p/${p.slug || p.id}; const src = p.source_url ? <div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="${p.source_url}">${p.source_url}</a></div> : ""; return <tr><td style="padding:12px 0;border-top:1px solid #eee"> <a href="${link}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${p.title}</a> ${summary ?<div style="font-size:13px;color:#555;margin-top:4px">${summary}</div>: ""} ${src} </td></tr>; }) .join("") || <tr><td>Za posledních 24h nemáme nové články.</td></tr>;

const html = <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px"> <h1 style="margin:0 0 12px">Pozitiva – přehled dne</h1> <div style="color:#666;font-size:13px;margin-bottom:16px">${date}</div> <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table> <div style="font-size:12px;color:#888;margin-top:24px"> Tento e-mail jste obdrželi na základě souhlasu. <a href="${site}/api/newsletter/unsubscribe?token={{TOKEN}}">Odhlásit odběr</a> </div> </div>.trim();

const { error: insErr } = await supabase .from("newsletter_issues") .insert({ subject, html, text: "", status: "draft" });

if (insErr) { return NextResponse.json({ ok: false, step: "insert_issue", error: insErr.message }, { status: 400 }); } return NextResponse.json({ ok: true, count: posts.length, used }); }

// GET: Vercel Cron (x-vercel-cron) nebo ručně ?secret=... export async function GET(req: Request) { const fromCron = !!req.headers.get("x-vercel-cron"); const url = new URL(req.url); const secret = url.searchParams.get("secret"); const haveEnv = !!process.env.CRON_SECRET;

if (!fromCron) { if (!secret) return NextResponse.json({ ok: false, reason: "missing-secret", haveEnv }, { status: 403 }); if (!haveEnv) return NextResponse.json({ ok: false, reason: "server-missing-CRON_SECRET" }, { status: 500 }); if (secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false, reason: "bad-secret" }, { status: 403 }); } return generateDraft(); }

// POST: ruční spuštění z admin UI (Bearer token + role=admin) export async function POST(req: Request) { const auth = req.headers.get("authorization") || ""; const token = auth.replace("Bearer ", ""); if (!token) return new NextResponse("Unauthorized", { status: 401 });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; const userClient = createClient(url, anon, { global: { headers: { Authorization: Bearer ${token} } } });

const { data: me } = await userClient.auth.getUser(); if (!me?.user) return new NextResponse("Unauthorized", { status: 401 });

const { data: prof } = await userClient.from("profiles").select("role").eq("id", me.user.id).single(); if (prof?.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

return generateDraft(); }