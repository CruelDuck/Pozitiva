"use client";
import { AuthOnly } from "@/components/Auth";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <AuthOnly>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Muj prehled</h1>
        <p className="text-gray-600">Spravuj sve clanky, koncepty a komentare.</p>
        <Link href="/dashboard/new" className="underline">Novy clanek</Link>
      </div>
    </AuthOnly>
  );
}