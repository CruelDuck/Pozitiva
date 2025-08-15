export async function verifyTurnstile(token: string, remoteip?: string) {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY || "",
        response: token,
        remoteip: remoteip || ""
      })
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    return false;
  }
}
