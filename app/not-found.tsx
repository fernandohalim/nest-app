import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7]">
      <div className="text-6xl mb-6 grayscale opacity-50" aria-hidden="true">
        🪹
      </div>

      <h2 className="text-xl font-black text-stone-800 mb-2 tracking-tight">
        404 — empty nest
      </h2>

      <p className="text-sm text-stone-500 font-bold mb-8">
        hmm, couldn&apos;t find the page you&apos;re looking for.
      </p>

      <Link
        href="/"
        className="px-6 py-3 bg-white border-2 border-stone-200 rounded-full text-sm text-stone-700 font-bold hover:border-emerald-500 hover:text-emerald-600 hover:-translate-y-1 transition-all shadow-sm flex items-center gap-2"
      >
        <span>←</span> head back home
      </Link>
    </main>
  );
}
