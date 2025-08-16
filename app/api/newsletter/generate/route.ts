import { NextResponse } from "next/server"; import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function makeExcerpt(html?: string, max = 180) { if (!html) return ""; const text = html .replace(/<[^>]*>/g, " ") .replace(/ | /gi, " ") .replace(/&/gi, "&") .replace(/</gi, "<") .replace(/>/gi, ">") .replace(/\s+/g, " ") .trim(); return text.length > max ? text.slice(0, max - 1) + "…" : text; }

async function safeFetchPosts(sb: any, sinceISO: string) { const orderCols = ["published_at", "created_at"]; const filters: Array<{ field?: string; value?: any; tag: string }> = [ { field: "is_published", value: true, tag: "is_published" }, { field: "status", value: "published", tag: "status" }, { tag: "nofilter" }, ];

// Zkoušej kombinace: (order by + gte) × (stav) for (const orderCol of orderCols) { for (const f of filters) { try { let q = sb.from("posts").select("*").order(orderCol as any, { ascending: false }).limit(12); // gte na existující sloupec – když neexistuje, catchne se to v erroru q = q.gte(orderCol as any, sinceISO); if (f.field) q = q.eq(f.field as any, f.value); const { data, error } = await q; if (!error) { return { data: data ?? [], used: { orderCol, filter: f.tag } }; } } catch (_) { // pokračuj dál } } }

// Poslední fallback: žádné datum ani stav – jen poslední položky podle id/created_at const fallbacks = ["created_at", "published_at", "id"]; for (const col of fallbacks) { const { data, error } = await sb.from("posts").select("*").order(col as any, { ascending: false }).limit(12); if (!error) { return { data: data ?? [], used: { orderCol: col, filter: "fallback" } }; } }

// Když ani to nevyjde, vrať prázdný výsledek (bez chyby) return { data: [], used: { orderCol: "none", filter: "none" } }; }

async function generateDraft() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const service = process.env.SUPABASE_SERVICE_ROLE; const site = process.env.NEXT_PUBLIC_SITE_URL ?? ""; if (!url || !service) { return NextResponse.json( { ok: false, step: "env_check", missing: { NEXT_PUBLIC_SUPABASE_URL: !url, SUPABASE_SERVICE_ROLE: !service } }, { status: 500 } ); }

const admin = createClient(url, service);

const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); const { data: posts, used } = await safeFetchPosts(admin, since);

const date = new Date().toLocaleDateString("cs-CZ"); const subject = Pozitiva – výběr dne (${date});

const itemsHtml = (posts || []) .map((p: any) => { const summary = makeExcerpt(p.content); const link = ${site}/p/${p.slug || p.id}; const src = p.source_url ? <div style="font-size:12px;color:#888;margin-top:4px">Zdroj: <a href="${p.source_url}">${p.source_url}</a></div> : ""; return <tr><td style="padding:12px 0;border-top:1px solid #eee"> <a href="${link}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${p.title ?? "Bez názvu"}</a> ${summary ?<div style="font-size:13px;color:#555;margin-top:4px">${summary}</div>: ""} ${src} </td></tr>; }) .join("") || <tr><td>Za posledních 24h nemáme nové články.</td></tr>;

const html = <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px"> <h1 style="margin:0 0 12px">Pozitiva – přehled dne</h1> <div style="color:#666;font-size:13px;margin-bottom:16px">${date}</div> <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table> <div style="font-size:12px;color:#888;margin-top:24px"> Tento e-mail jste obdrželi na základě souhlasu. <a href="${site}/api/newsletter/unsubscribe?token={{TOKEN}}">Odhlásit odběr</a> </div> </div>.trim();
