'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

declare global { interface Window { turnstile?: any; ENV?: any } }

type Props = { postId: string; parentId?: string; onSuccess?: () => void }

export default function CommentForm({ postId, parentId, onSuccess }: Props) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  // CAPTCHA
  const siteKey =
    (typeof window !== 'undefined' && window.ENV?.TURNSTILE_SITE_KEY) ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ''
  const hostRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<any>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  // Programaticky vykresli Turnstile
  useEffect(() => {
    if (!siteKey) { setToken('dev'); return } // DEV režim bez CAPTCHA
    let cancelled = false
    let tries = 0

    const tryRender = () => {
      if (cancelled) return
      if (typeof window !== 'undefined' && window.turnstile && hostRef.current) {
        try {
          widgetIdRef.current = window.turnstile.render(hostRef.current, {
            sitekey: siteKey,
            callback: (t: string) => setToken(t),
            'expired-callback': () => setToken(null),
            'error-callback': () => setToken(null),
          })
        } catch {
          if (tries++ < 20) setTimeout(tryRender, 300)
        }
      } else {
        if (tries++ < 20) setTimeout(tryRender, 300)
      }
    }

    tryRender()
    return () => { cancelled = true }
  }, [siteKey])

  async function submit() {
    setError(null)
    if (!user) { setError('Přihlašte se.'); return }
    if (!body.trim()) { setError('Napište komentář.'); return }

    if (siteKey && !token) { setError('Dokončete ověření (CAPTCHA).'); return }

    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session?.session?.access_token || ''
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ postId, content: body, parentId: parentId || null, turnstileToken: token }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) { setError(out?.error || 'Nepodařilo se odeslat komentář.'); return }

      setBody('')
      setToken(siteKey ? null : 'dev')
      try { window.turnstile?.reset(widgetIdRef.current) } catch {}
      onSuccess?.()
    } catch (e: any) {
      setError(e.message || 'Chyba při odesílání.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        className="w-full border rounded-md p-2 text-sm"
        rows={3}
        placeholder="Napiš milý komentář…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center gap-2">
        {siteKey ? <div ref={hostRef} /> : <div className="text-xs text-zinc-500">CAPTCHA vypnutá (DEV).</div>}
        <button
          onClick={submit}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 disabled:opacity-50"
        >
          Odeslat
        </button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}
