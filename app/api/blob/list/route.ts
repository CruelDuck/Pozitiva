import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const runtime = 'edge'

export async function GET() {
  const { blobs } = await list()
  const items = blobs
    .filter((b) => (b.pathname || '').match(/\.(png|jpe?g|webp|gif|svg)$/i))
    .map((b) => ({
      url: b.url,
      pathname: b.pathname,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }))
  return NextResponse.json({ items })
}