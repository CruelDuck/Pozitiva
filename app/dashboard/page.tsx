"use client";
import { AuthOnly } from "@/components/Auth";

export default function DashboardPage() {
  return (
    <AuthOnly>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Můj přehled</h1>
        <p className="text-gray-600">
          Tady můžeš spravovat své články, koncepty a komentáře.
        </p>
        {/* Sem patří tvoje reálné widgety / seznamy. */}
      </div>
    </AuthOnly>
  );
}