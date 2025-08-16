import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESEND_URL = "https://api.resend.com/emails";

export async function POST(req: Request) {
  // autorizace adminem – posíláme bearer token z klienta
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });

  // ověř roli
  const { data: me } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("role,email").eq("id", me.user?.id).single();
  if (!prof || prof.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const { issueId, testEmail } = await req.json();

  const { data: issue } = await sb
    .from("newsletter_issues")
    .select("id, subject, html, status")
    .eq("id", issueId).single();

  if (!issue) return new NextResponse("Issue not found", { status: 404 });

  const from = process.env.NEWSLETTER_FROM!;
  const replyTo = process.env.NEWSLETTER_REPLY_TO || undefined;

  // test send: poslat jen na jednu adresu
  if (testEmail) {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [testEmail], subject: issue.subject, html: issue.html, reply_to: replyTo }),
    });
    if (!r.ok) return new NextResponse(await r.text(), { status: 400 });
    return NextResponse.json({ ok: true, test: true });
  }

  // ostré rozeslání – jen potvrzeným a nepřihlášeným k odhlášení
  const { data: subs } = await sb
    .from("newsletter_subscribers")
    .select("email, token")
    .is("unsubscribed_at", null)
    .not("confirmed_at", "is", null);

  const recipients = (subs || []).map(s => s.email);
  if (recipients.length === 0) return NextResponse.json({ ok: false, reason: "no-subscribers" });

  // jednoduché rozeslání v jedné dávce (pro začátek)
  const htmlWithTokens = (subs || []).map(s => issue.html.replace("{{TOKEN}}", encodeURIComponent(s.token)));

  // kvůli limitům providerů je lepší posílat po dávkách – pro jednoduchost pošleme jednu dávku s BCC není vhodné (Resend neřeší BCC přes API jednoduše)
  // => pošli e-maily jednotlivě (základní verze)
  for (let i = 0; i < recipients.length; i++) {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipients[i]],
        subject: issue.subject,
        html: htmlWithTokens[i],
        reply_to: replyTo,
      }),
    });
    if (!r.ok) {
      const msg = await r.text();
      console.error("send fail", recipients[i], msg);
    }
    // případně drobný delay
    // await new Promise(r => setTimeout(r, 100));
  }

  await sb.from("newsletter_issues").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", issue.id);
  return NextResponse.json({ ok: true, sent: recipients.length });
}