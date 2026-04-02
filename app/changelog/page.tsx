"use client";

import { useRouter } from "next/navigation";
import packageJson from "../../package.json";

const releases = [
  {
    version: "1.2.2",
    date: "apr 2, 2026",
    title: "small changes 😊",
    badge: "patch",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    features: ["fix info icon size inconsistency."],
  },
  {
    version: "1.2.1",
    date: "apr 2, 2026",
    title: "crew management & prompt fix 👥",
    badge: "patch",
    badgeColor: "bg-sky-100 text-sky-700 border-sky-200",
    features: [
      "added rename members feature.",
      "refine the member management into a dedicated popup modal.",
      "fix the receipt scanner prompt to strictly output exact category matches.",
    ],
  },
  {
    version: "1.2",
    date: "mar 31, 2026",
    title: "math & polish 💅",
    badge: "feature",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    features: [
      "added a dedicated in-app changelog page.",
      "added transparent breakdowns for custom adjustments in the detailed ledger.",
      "refine the about screen with new social buttons.",
      "fixed a 'phantom tax' math bug for weighted item splits.",
      "fixed some price ui alignment across the board to snap cleanly to the right edge.",
    ],
  },
  {
    version: "1.1",
    date: "mar 31, 2026",
    title: "receipts & ledgers ✨",
    badge: "feature",
    badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
    features: [
      "added new receipt scanning logic to handle specific item discounts.",
      "added logic to isolate individual item discounts from global tax and discount math.",
      "added individual item prices directly inside the detailed ledger section.",
      "added transparent item breakdowns associated with each member in the expense list.",
    ],
  },
  {
    version: "1.0.1",
    date: "mar 31, 2026",
    title: "bug fixing 🐛",
    badge: "patch",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-200",
    features: [
      "added a shiny new about screen with creator social links.",
      "fixed a buggy bouncing arrow on the home screen empty state.",
      "fixed an issue where the about screen wouldn't show when a trip was empty.",
    ],
  },
  {
    version: "1.0",
    date: "mar 31, 2026",
    title: "the beginning 🐣",
    badge: "launch",
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    features: [
      "launched 'nest.' into the wild!",
      "receipt scanning with gemini!",
      "exact splitting, equal splitting, and custom adjustments.",
      "smart debt optimization (who pays who).",
      "beautiful, transparent ledger breakdowns.",
    ],
  },
];

export default function Changelog() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-32 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* sticky cozy header */}
        <div className="sticky top-0 pt-4 pb-4 bg-[#fdfbf7]/90 backdrop-blur-xl z-20 flex items-center justify-between mb-8 border-b border-stone-100/50">
          <button
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 active:scale-95 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex flex-col items-end">
            <h1 className="text-xl font-black text-stone-800 tracking-tight">
              changelog 📖
            </h1>
            <span className="text-[10px] font-bold text-stone-400 tracking-widest uppercase">
              current version {packageJson.version}
            </span>
          </div>
        </div>

        {/* the timeline */}
        {/* 🔥 removed the md:before classes so the line stays on the left everywhere */}
        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-1 before:bg-linear-to-b before:from-emerald-200 before:to-stone-100 before:rounded-full">
          {releases.map((release, index) => (
            <div
              key={release.version}
              // 🔥 removed alternating zigzag md: classes
              className="relative flex items-center justify-between group is-active animate-in slide-in-from-bottom-4 fade-in duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* timeline node */}
              {/* 🔥 removed md: transform classes */}
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#fdfbf7] bg-emerald-400 text-white shadow-sm shrink-0 relative z-10 group-hover:scale-110 transition-transform">
                <span className="text-sm font-black text-white">
                  v{release.version.split(".")[0]}
                </span>
              </div>

              {/* content card */}
              {/* 🔥 removed md:w-[50%] classes so it always takes the remaining width */}
              <div className="w-[calc(100%-3rem)] p-5 rounded-3xl bg-white border-2 border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group-hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  {/* 🔥 grouped badge and full version together */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${release.badgeColor}`}
                    >
                      v{release.version} - {release.badge}
                    </span>
                  </div>
                  <time className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0">
                    {release.date}
                  </time>
                </div>

                <h3 className="text-lg font-extrabold text-stone-800 mb-3">
                  {release.title}
                </h3>

                <ul className="space-y-2">
                  {release.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="text-sm font-bold text-stone-500 flex items-start gap-2 leading-tight"
                    >
                      <span className="text-emerald-400 mt-0.5 shrink-0">
                        ↳
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
