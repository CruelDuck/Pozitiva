import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Z bezpečnostních důvodů používáme dva klienty:
// - userClient (ANON + Authorization) pro zjištění, kdo volá
// - adminClient (SERVICE ROLE) pro smazání auth uživatele
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    const { confirm } = await req.json();
    if (confirm !== "SMAZAT") {
      return new NextResponse("Bad confirmation", { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!service) {
      return new NextResponse("Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: me, error: meErr } = await userClient.auth.getUser();
    if (meErr || !me?.user) return new NextResponse("Unauthorized", { status: 401 });

    const adminClient = createClient(url, service);
    const { error: delErr } = await adminClient.auth.admin.deleteUser(me.user.id);

    if (delErr) return new NextResponse(delErr.message || "Delete failed", { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status || 500;
    return new NextResponse(e?.message || "Server error", { status });
  }
}