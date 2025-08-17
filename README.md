# Pozitiva

## Pozitivní – rychlý start

1. `cp .env.example .env.local` a doplň všechny klíče (Supabase, Resend, Blob, Turnstile).
2. V Supabase spusť `supabase/schema.sql`.
3. `npm i` a `npm run dev` (nebo `pnpm dev`).
4. V DB nastav u svého profilu `role = 'admin'` (pro administraci).
5. Nasazení na Vercel: přidej env proměnné z `.env.example` a povol doménu Blob v `next.config.js` (remotePatterns).
