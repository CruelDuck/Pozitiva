"use client";
import AdminOnly from "@/components/AdminOnly";

export default function AdminPage() {
  return (
    <AdminOnly>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-gray-600">Moderace a sprava obsahu (pripravujeme).</p>
      </div>
    </AdminOnly>
  );
}