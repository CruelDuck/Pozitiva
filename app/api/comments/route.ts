// app/api/comments/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// ---- Supabase admin client (Service Role) ---- 
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

// ---- Types ----
type Body = {
  postId: string;           // uuid článku
  content: string;          // text komentáře
  parentId?: number | null; // volitelné: ID nadřazeného komentáře (thread)
  turnstileToken?: string;  // CAPTCHA token z klienta
};

// ---- Helpers ----
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function unauthorized(msg = 'Nejsi přihlášen.') {
  return NextResponse.json({ error: msg }, { status: 401 });
}
function serverError(err: unknown) {
  const msg = typeof err === 'object' && err && 'message' in err ? (err as any).message : String(err);
  return NextResponse.json({ error: msg }, { status: 500 });
}

// Ověření Cloudflare Turnstile – jen když je k dispozici SECRET
async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // DEV/preview: není nastaveno ověřování → povolit
    return { ok: true as const };
  }
  if (!token) {
    return { ok: false as const, error: 'Chybí ověření (CAPTCHA).' };
  }

  const form = new URLSearchParams();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const data = (await r.json()) as { success: boolean; ['error-codes']?: string[] };
  if (!data?.success) {
    return {
      ok: false as const,
      error: `Neprošla verifikace CAPTCHA${data['error-codes']?.length ? `: ${data['error-codes'].join(', ')}` : ''}.`,
    };
  }
  return { ok: true as const };
}

// Vytažení user id (sub) z Authorization: Bearer <jwt>
async function userFromAuthHeader(authHeader: string | null): Promise<{ id: string | null }> {
  try {
    if (!authHeader?.toLowerCase().startsWith('bearer ')) return { id: null };
    const jwt = authHeader.split(' ')[1];
    const payloadStr = Buffer.from((jwt.split('.')[1] || ''), 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    return { id: (payload?.sub as string) || null };
  } catch {
    return { id: null };
  }
}

// Optional: preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

// ---- POST /api/comments ----
export async function POST(req: Request) {
  try {
    const { postId, content, parentId = null, turnstileToken } = (await req.json()) as Body;

    // Základní validace
    if (!postId || typeof postId !== 'string') return badRequest('Chybí postId.');
    if (!content || typeof content !== 'string' || !content.trim()) return badRequest('Chybí obsah komentáře.');
    if (content.length > 5000) return badRequest('Komentář je příliš dlouhý (max 5000 znaků).');

    // CAPTCHA (jen v prod, když je secret)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null;
    const v = await verifyTurnstile(turnstileToken, ip);
    if (!v.ok) return badRequest(v.error);

    // Uživatel
    const authHeader = req.headers.get('authorization');
    const user = await userFromAuthHeader(authHeader);
    if (!user.id) return unauthorized();

    // INSERT přes RPC – robustní vůči schema cache
    const { data, error } = await supa.rpc('add_comment', {
      parent: parentId ?? null,
      pid: postId,
      txt: content.trim(),
      uid: user.id,
    });

    if (error) {
      // typicky: funkce zatím není v cache → doporuč tip
      if (String(error.message || '').toLowerCase().includes('not found')) {
        return serverError(
          'RPC funkce add_comment není dostupná (schema cache). Zkus v DB provést: notify pgrst, \'reload schema\';'
        );
      }
      return serverError(error);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(
      { ok: true, id: row?.id, created_at: row?.created_at },
      { status: 200 }
    );
  } catch (e) {
    return serverError(e);
  }
}
