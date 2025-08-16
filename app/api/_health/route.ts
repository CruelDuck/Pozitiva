export async function GET() {
  const haveCronSecret = !!process.env.CRON_SECRET;
  return new Response(JSON.stringify({ ok: true, haveCronSecret }), {
    headers: { "content-type": "application/json" },
  });
}