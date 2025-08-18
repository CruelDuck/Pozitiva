import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN })
    const items = (blobs || [])
      .filter(b => (b.pathname || '').match(/\.(png|jpe?g|webp|gif|svg)$/i))
      .map(b => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
      }))
    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ items: [], error: String(e?.message || e) })
  }
}