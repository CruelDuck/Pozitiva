import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTurnstile } from "@/lib/turnstile";
import { limitOrThrow } from "@/lib/upstash";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { postId, body: text, parentId, turnstileToken } = body || {};
    if (!postId || !text) return new NextResponse("Missing fields", { status: 400 });

    // Rate limit by IP
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim();
    await limitOrThrow(ip || "global");

    // Turnstile verify
    if (!process.env.TURNSTILE_SECRET_KEY) {
      return new NextResponse("Server missing TURNSTILE_SECRET_KEY", { status: 500 });
    }
    const ok = await verifyTurnstile(turnstileToken || "", ip);
    if (!ok) return new NextResponse("Turnstile failed", { status: 400 });

    // Insert using user's JWT (RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      body: String(text).slice(0, 1000),
      parent_id: parentId || null,
      user_id: userData.user.id,
    });

    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    return new NextResponse(e?.message || "Server error", { status });
  }
}
