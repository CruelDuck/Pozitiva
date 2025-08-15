import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "edge";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename") || `upload-${Date.now()}`;
  const contentType = req.headers.get("content-type") || undefined;
  const blob = await put(filename, req.body!, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return NextResponse.json(blob);
}
