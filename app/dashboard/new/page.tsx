"use client";
import { AuthOnly } from "@/components/Auth";
import Link from "next/link";

export default function NewPostPage() {
  return (
    <AuthOnly>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nový článek</h1>
        <p className="text-gray-600">
          Sem přijde editor (Tiptap). Pokud už ho máš v projektu jako komponentu,
          vlož ho sem; gating je hotový.
        </p>
        <Link href="/dashboard" className="underline">Zpět na přehled</Link>
      </div>
    </AuthOnly>
  );
}
