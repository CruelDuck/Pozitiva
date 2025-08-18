import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { nanoid } from 'nanoid'


export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const filename = (url.searchParams.get('filename') || 'file').replace(/\s+/g, '-')
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
    const key = `${new Date().toISOString().slice(0,10)}/${nanoid(8)}.${ext}`

    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) throw new Error('Missing BLOB_READ_WRITE_TOKEN')

    const blob = await put(key, req.body!, { access: 'public', token })
    // blob.url je veřejná HTTPS adresa
    return NextResponse.json({ url: blob.url })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}