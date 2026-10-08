"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import packageJson from "../../package.json";
import { releases } from "@/lib/changelog";
import { Release } from "@/lib/types";

// every changelog line starts with a verb ("added …", "fixed …"). lifting it
// into a chip lets the eye scan by kind of change instead of reading every
// sentence; lines without a known verb render as-is.
type ChangeKind = "new" | "refined" | "fixed" | "removed";

const KIND_BY_VERB: Record<string, ChangeKind> = {
  added: "new",
  launched: "new",
  refined: "refined",
  refine: "refined",
  fixed: "fixed",
  fix: "fixed",
  removed: "removed",
};

const KIND_STYLE: Record<ChangeKind, string> = {
  new: "bg-emerald-50 text-emerald-700 border-emerald-100",
  refined: "bg-sky-50 text-sky-700 border-sky-100",
  fixed: "bg-amber-50 text-amber-700 border-amber-100",
  removed: "bg-stone-100 text-stone-500 border-stone-200",
};

const KIND_ORDER: ChangeKind[] = ["new", "refined", "fixed", "removed"];

type Change = { kind: ChangeKind | null; text: string };

const parseChange = (line: string): Change => {
  const match = line.match(/^(\S+)\s+([\s\S]*)$/);
  const kind = match ? KIND_BY_VERB[match[1]] : undefined;
  return kind ? { kind, text: match![2] } : { kind: null, text: line };
};

const isMajor = (r: Release) => /^\d+\.0$/.test(r.version);
const isPatch = (r: Release) => r.version.split(".").length === 3;

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="space-y-2.5">
      {changes.map((change, idx) => (
        <li key={idx} className="flex items-start gap-2.5">
          <span
            className={`mt-px shrink-0 w-16 text-center text-[9px] font-black uppercase tracking-widest py-0.5 rounded-md border ${
              change.kind ? KIND_STYLE[change.kind] : "border-transparent"
            }`}
          >
            {change.kind ?? "·"}
          </span>
          <span className="text-[13px] font-medium text-stone-600 leading-relaxed">
            {change.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function KindSummary({ counts }: { counts: Record<ChangeKind, number> }) {
  const parts = KIND_ORDER.filter((k) => counts[k] > 0);
  if (parts.length === 0) return null;
  return (
    <span className="text-[11px] font-bold text-stone-400 truncate">
      {parts.map((k, i) => (
        <span key={k}>
          {i > 0 && " · "}
          {counts[k]} {k}
        </span>
      ))}
    </span>
  );
}

export default function Changelog() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const parsed = useMemo(
    () =>
      releases.map((release) => {
        const changes = release.features.map(parseChange);
        const counts = { new: 0, refined: 0, fixed: 0, removed: 0 };
        changes.forEach((c) => {
          if (c.kind) counts[c.kind] += 1;
        });
        return { release, changes, counts };
      }),
    [],
  );

  const latest = parsed[0];
  const older = useMemo(() => parsed.slice(1), [parsed]);

  // releases grouped by major series: nest 3, nest 2, nest 1
  const series = useMemo(() => {
    const groups: { major: string; items: typeof older }[] = [];
    older.forEach((entry) => {
      const major = entry.release.version.split(".")[0];
      let group = groups.find((g) => g.major === major);
      if (!group) {
        group = { major, items: [] };
        groups.push(group);
      }
      group.items.push(entry);
    });
    return groups;
  }, [older]);

  const allExpanded = older.every((e) => expanded.has(e.release.version));
  const toggle = (version: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });


  return (
    <main className="flex min-h-screen flex-col items-center p-6 lg:p-10 bg-[#fdfbf7] pb-32 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md lg:max-w-2xl relative">
        <div className="sticky top-0 pt-4 pb-4 bg-[#fdfbf7]/90 backdrop-blur-xl z-20 flex items-center justify-between mb-6 border-b border-stone-100/50">
          <button
            onClick={() => router.push("/")}
            aria-label="back home"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 active:scale-95 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
              you&apos;re on v{packageJson.version}
            </span>
          </div>
        </div>

        {/* latest release — always open */}
        {latest && (
          <section className="mb-8 bg-white border-2 border-stone-100 rounded-4xl shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 bg-linear-to-br from-emerald-50 to-white border-b-2 border-stone-100">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                  latest · v{latest.release.version}
                </span>
                <time className="text-[11px] font-bold text-stone-400 shrink-0">
                  {latest.release.date}
                </time>
              </div>
              <h2 className="text-2xl font-black text-stone-800 leading-tight">
                {latest.release.title}
              </h2>
              <div className="mt-1.5">
                <KindSummary counts={latest.counts} />
              </div>
            </div>
            <div className="px-6 py-5">
              <ChangeList changes={latest.changes} />
            </div>
          </section>
        )}

        <div className="flex justify-end px-2 mb-2">
          <button
            onClick={() =>
              setExpanded(
                allExpanded
                  ? new Set()
                  : new Set(older.map((e) => e.release.version)),
              )
            }
            className="shrink-0 text-xs font-black text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            {allExpanded ? "collapse all" : "expand all"}
          </button>
        </div>

        <div className="space-y-7">
          {series.map((group) => {
            const first = group.items[group.items.length - 1].release;
            const last = group.items[0].release;
            return (
              <section key={group.major}>
                <div className="flex items-baseline justify-between px-2 mb-2">
                  <h2 className="text-sm font-black text-stone-800">
                    nest {group.major}
                  </h2>
                  <span className="text-[11px] font-bold text-stone-400">
                    {first.date === last.date
                      ? last.date
                      : `${first.date} – ${last.date}`}
                  </span>
                </div>
                <div className="bg-white rounded-3xl border-2 border-stone-100 shadow-sm divide-y divide-stone-100 overflow-hidden">
                  {group.items.map(({ release, changes, counts }) => {
                    const isOpen = expanded.has(release.version);
                    const major = isMajor(release);
                    return (
                      <div key={release.version}>
                        <button
                          onClick={() => toggle(release.version)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50/80 active:bg-stone-100 transition-colors group"
                        >
                          <span
                            className={`shrink-0 w-14 py-1 rounded-lg text-center text-[11px] font-black tabular-nums border ${
                              major
                                ? "bg-stone-900 text-white border-stone-900"
                                : isPatch(release)
                                  ? "bg-stone-50 text-stone-500 border-stone-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            }`}
                          >
                            {major && <span aria-hidden="true">🚀 </span>}
                            {release.version}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-[15px] text-stone-800 truncate group-hover:text-emerald-700 transition-colors">
                              {release.title}
                            </p>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <time className="shrink-0 text-[11px] font-bold text-stone-400">
                                {release.date}
                              </time>
                              {Object.values(counts).some((n) => n > 0) && (
                                <span
                                  className="text-stone-300"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                              )}
                              <KindSummary counts={counts} />
                            </div>
                          </div>
                          <svg
                              className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                                isOpen
                                  ? "rotate-180 text-emerald-500"
                                  : "text-stone-300"
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-1">
                            <ChangeList changes={changes} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-14 text-center text-xs font-black text-stone-300 uppercase tracking-widest">
          more magic coming soon ✨
        </p>
      </div>
    </main>
  );
}
