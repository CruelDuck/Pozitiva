"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DeleteAccountPage() {
  const [me, setMe] = useState<any>(null);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user));
  }, []);

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!me) return setMsg("Nejste přihlášen.");
    if (confirm !== "SMAZAT") {
      return setMsg('Pro potvrzení napište přesně: "SMAZAT"');
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token || ""}`,
        },
        body: JSON.stringify({ confirm }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Smazání selhalo");
      // úspěch → domů
      router.replace("/");
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!me) {
    return <div className="max-w-md mx-auto p-6">Přihlaste se, prosím.</div>;
  }

  return (
    <div className="max-w-md mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-semibold mb-2">Smazat účet</h1>
      <p className="text-sm text-gray-600">
        Tato akce je nevratná. Smažou se vaše osobní údaje a komentáře.
        Publikované články zůstanou (autor bude anonymizován).
      </p>

      <form onSubmit={onDelete} className="mt-4 space-y-3">
        <label className="text-sm block">
          Pro potvrzení napište <b>SMAZAT</b>:
        </label>
        <input
          className="w-full border rounded-md p-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="SMAZAT"
        />

        <button
          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50"
          disabled={loading || confirm !== "SMAZAT"}
        >
          Trvale smazat účet
        </button>

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </form>
    </div>
  );
}