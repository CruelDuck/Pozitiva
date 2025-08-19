// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/Auth";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pozitiva.vercel.app";
const TITLE = "Pozitiva";
const DESCRIPTION = "Pozitivní zprávy – hezké novinky každý den.";
<script
  dangerouslySetInnerHTML={{
    __html: `window.ENV = { TURNSTILE_SITE_KEY: ${JSON.stringify(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '')} }`,
  }}
/>

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // volitelné:
  // robots: "index,follow",
  // themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className="h-full bg-gray-50">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AuthProvider>
          <Header />
          <main id="content" className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-4 py-6">{children}</div>
          </main>
          <footer className="border-t bg-white">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-gray-600">
              © {new Date().getFullYear()} Pozitivní Zprávy · Postaveno na Next.js &amp; Supabase
            </div>
          </footer>
        </AuthProvider>

        {/* Cloudflare Turnstile pro ochranu formulářů (komentáře apod.) */}
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      </body>
    </html>
  );
}
