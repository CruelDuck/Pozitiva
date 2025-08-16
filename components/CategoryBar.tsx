"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Cat = { slug: string; title: string };

export default function CategoryBar() {
  const [cats, setCats] = useState<Cat[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("slug,title")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setCats(data || []);
    })();
  }, []);

  return (
    <div className="w-full border-b bg-white sticky top-14 z-30">
      <div className="max-w-6xl mx-auto px-3 py-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-full border text-sm ${pathname === "/" ? "bg-gray-100" : "hover:bg-gray-50"}`}
          >
            Vše
          </Link>
          {cats.map((c) => (
            <Link
              key={c.slug}
              href={`/k/${c.slug}`}
              className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50 whitespace-nowrap"
            >
              {c.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}