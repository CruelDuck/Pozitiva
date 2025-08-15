import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Try a public nameday API for CZ; if it fails, return generic text.
    const res = await fetch("https://nameday.abalin.net/api/V1/today?country=CZ", { cache: "no-store" });
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    // Abalin API format example: { data: { name_cz: ["..."] } } may vary; try common keys:
    const name = data?.data?.namedays?.cz || data?.data?.name_cz || data?.name || "Hezký den";
    const value = Array.isArray(name) ? name[0] : name;
    return NextResponse.json({ nameday: value || "Hezký den" });
  } catch {
    return NextResponse.json({ nameday: "Hezký den" });
  }
}
