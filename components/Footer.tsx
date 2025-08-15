export default function Footer() {
  return (
    <footer className="border-t bg-white mt-10">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-gray-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Pozitivní Zprávy</span>
        <span>Postaveno na Next.js & Supabase</span>
      </div>
    </footer>
  );
}
