import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/Auth";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Pozitiva",
  description: "Pozitivni zpravy – hezke novinky kazdy den.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pozitiva.vercel.app"),
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "Pozitiva",
    description: "Pozitivni zpravy – hezke novinky kazdy den.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://pozitiva.vercel.app",
    siteName: "Pozitiva",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pozitiva",
    description: "Pozitivni zpravy – hezke novinky kazdy den.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className="h-full bg-gray-50">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AuthProvider>
          <Header />
          <main className="flex-1">
            <div className="mx-auto max-w-5xl w-full px-4 py-6">
              {children}
            </div>
          </main>
          <footer className="border-t bg-white">
            <div className="mx-auto max-w-5xl w-full px-4 py-6 text-sm text-gray-600">
              © {new Date().getFullYear()} Pozitivni Zpravy · Postaveno na Next.js &amp; Supabase
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}