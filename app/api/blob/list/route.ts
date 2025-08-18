// app/api/blob/list/route.ts
import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

export const runtime = 'nodejs' // stabilní runtime

export async function GET() {
  try {
    const { blobs } = await list()
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
    // místo 500 vrátíme prázdný list + text chyby, aby UI nespadlo
    return NextResponse.json({ items: [], error: String(e?.message || e) })
  }
}