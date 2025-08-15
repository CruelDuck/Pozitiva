import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * --- Turnstile verify (inline) ---
 */
async function verifyTurnstile(responseToken: string, remoteIp?: string | null) {
  try {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) return false;
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", responseToken || "");
    if (remoteIp) form.set("remoteip", remoteIp);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

/**
 * --- Upstash rate-limit (inline) ---
 * Fixed-window: max `limit` požadavků za `windowSec` pro identifikátor (např. IP).
 * Pokud Upstash není nastaven, RATE-LIMIT přeskočíme (nebude blokovat).
 */
async function limitOrThrow(
  id: string,
  limit = 5,
  windowSec = 60
) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return;

  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:comments:${id}:${bucket}`;

  const headers = { Authorization: `Bearer ${token}` };

  const incr = await fetch(`${base}/incr/${encodeURIComponent(key)}`, { method: "POST", headers });
  const { result: count } = await incr.json();

  if (count === 1) {
    await fetch(`${base}/expire/${encodeURIComponent(key)}/${windowSec}`, { method: "POST", headers });
  }
  if (typeof count === "number" && count > limit) {
    const err: any = new Error("Too Many Requests");
    err.status = 429;
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    // --- Auth token (RLS insert poběží pod uživatelem) ---
    const auth = req.headers.get("authorization") || "";
    const accessToken = auth.replace("Bearer ", "");
    if (!accessToken) return new NextResponse("Unauthorized", { status: 401 });

    const { postId, body, parentId, turnstileToken } = await req.json();

    if (!postId || !body) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // --- IP + RateLimit + Turnstile ---
    const ip =
      (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
        .split(",")[0]
        .trim() || "global";

    await limitOrThrow(ip, 5, 60);

    const ok = await verifyTurnstile(turnstileToken || "", ip);
    if (!ok) return new NextResponse("Turnstile failed", { status: 400 });

    // --- Supabase klient s JWT uživatele (pro RLS) ---
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // Ověř, že user existuje
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user) return new NextResponse("Unauthorized", { status: 401 });

    // --- Insert komentáře, vrať si ID hned zpět ---
    const text = String(body).slice(0, 1000);
    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: me.user.id,
        parent_id: parentId || null,
        body: text,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return new NextResponse(error?.message || "Insert failed", { status: 400 });
    }

    // --- @mentions: vytáhni @username a ulož do comment_mentions ---
    const usernames = Array.from(text.matchAll(/@([a-zA-Z0-9_]{2,30})/g)).map((m) =>
      m[1]
    );
    if (usernames.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username")
        .in("username", usernames as any);

      const pairs =
        (profs || []).map((p: any) => ({
          comment_id: inserted.id,
          mentioned_user_id: p.id,
        })) || [];

      if (pairs.length) {
        await supabase.from("comment_mentions").insert(pairs);
      }
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e: any) {
    const status = e?.status || 500;
    return new NextResponse(e?.message || "Server error", { status });
  }
}