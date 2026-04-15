"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import packageJson from "../../package.json";
import { releases } from "@/lib/changelog";

export default function Changelog() {
  const router = useRouter();

  // 🔥 state to track which patch versions are currently expanded
  const [expandedVersions, setExpandedVersions] = useState<
    Record<string, boolean>
  >({});

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-32 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* sticky cozy header */}
        <div className="sticky top-0 pt-4 pb-4 bg-[#fdfbf7]/90 backdrop-blur-xl z-20 flex items-center justify-between mb-8 border-b border-stone-100/50">
          <button
            onClick={() => router.push("/")}
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

        {/* the weighted timeline wrapper */}
        <div className="space-y-5 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-1/2 before:h-full before:w-1 before:bg-linear-to-b before:from-emerald-300 before:via-stone-200 before:to-stone-100 before:rounded-full">
          {releases.map((release, index) => {
            // dynamic weight logic
            const parts = release.version.split(".");
            let weight = 3;
            if (parts.length === 2) {
              weight = parts[1] === "0" ? 1 : 2;
            }

            // 🔥 major (1) and minor (2) versions are always open. patches (3) use state.
            const isExpanded =
              weight !== 3 || expandedVersions[release.version];

            // render different nodes based on weight
            let Node = null;
            if (weight === 1) {
              Node = (
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[#fdfbf7] bg-stone-900 shadow-xl relative z-10 group-hover:scale-110 group-hover:-rotate-12 transition-transform">
                  <span className="text-xl">🚀</span>
                </div>
              );
            } else if (weight === 2) {
              Node = (
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#fdfbf7] bg-emerald-400 text-white shadow-sm relative z-10 group-hover:scale-110 transition-transform mt-0.5">
                  <span className="text-[10px] font-black">
                    v{release.version}
                  </span>
                </div>
              );
            } else {
              Node = (
                <div className="flex items-center justify-center w-5 h-5 rounded-full border-[3px] border-[#fdfbf7] bg-stone-300 relative z-10 group-hover:bg-sky-400 group-hover:scale-125 transition-all mt-2.5"></div>
              );
            }

            return (
              <div
                key={release.version}
                className={`relative flex gap-3 sm:gap-4 group is-active animate-in slide-in-from-bottom-4 fade-in duration-500 ${
                  weight === 1 ? "mt-12" : ""
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* node column */}
                <div className="w-12 flex justify-center shrink-0">{Node}</div>

                {/* content card */}
                <div
                  onClick={() => {
                    // 🔥 toggle expansion ONLY if it's a patch version
                    if (weight === 3) {
                      setExpandedVersions((prev) => ({
                        ...prev,
                        [release.version]: !prev[release.version],
                      }));
                    }
                  }}
                  className={`flex-1 transition-all group-hover:-translate-y-1 ${
                    weight === 3 ? "cursor-pointer" : "cursor-default"
                  } ${
                    weight === 1
                      ? "p-6 rounded-4xl bg-white border-2 border-stone-300 shadow-lg hover:shadow-xl hover:border-emerald-500" // anchor Card
                      : weight === 2
                        ? "p-5 rounded-3xl bg-white border-2 border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-200" // feature Card
                        : "p-4 rounded-2xl bg-white/50 border border-stone-100/80 shadow-sm hover:bg-white hover:border-stone-200" // patch Card
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${release.badgeColor}`}
                      >
                        v{release.version} - {release.badge}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <time className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0">
                        {release.date}
                      </time>
                      {/* 🔥 animated chevron ONLY for patches */}
                      {weight === 3 && (
                        <svg
                          className={`w-4 h-4 text-stone-300 transition-transform duration-300 ${
                            isExpanded ? "rotate-180 text-emerald-500" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M19 9l-7 7-7 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* title scales based on weight */}
                  <h3
                    className={`font-extrabold text-stone-800 ${
                      weight === 1
                        ? "text-2xl"
                        : weight === 2
                          ? "text-lg"
                          : "text-base"
                    } ${isExpanded ? "mb-3" : "mb-1"}`}
                  >
                    {release.title}
                  </h3>

                  {/* conditionally render features based on state */}
                  {isExpanded && (
                    <ul className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                      {release.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className={`text-sm font-bold flex items-start gap-2 leading-tight ${
                            weight === 3 ? "text-stone-400" : "text-stone-500"
                          }`}
                        >
                          <span
                            className={`mt-0.5 shrink-0 transition-colors ${
                              weight === 1
                                ? "text-stone-800 group-hover:text-emerald-500"
                                : weight === 2
                                  ? "text-emerald-400"
                                  : "text-stone-300 group-hover:text-sky-400"
                            }`}
                          >
                            ↳
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs font-black text-stone-300 uppercase tracking-widest animate-pulse">
            more magic coming soon ✨
          </p>
        </div>
      </div>
    </main>
  );
}
