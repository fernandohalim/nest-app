"use client";

import { ReactNode, useEffect, useRef } from "react";
import { Expense, Trip } from "@/lib/types";
import { RetentionInfo } from "@/lib/retention";
import { formatDisplayDate } from "@/lib/datetime";
import { formatMoney, getCurrencySymbol } from "@/lib/format";

// 3.1.1 home list: compact rows grouped into one card per month, instead of
// a tall standalone card per trip/receipt. the page still owns filtering,
// sorting and selection — this file is only presentation + scroll paging.

export const LIST_PAGE_SIZE = 20;

// ─── grouping ───────────────────────────────────────────────────────────────

export interface ListSection<T> {
  key: string;
  // null = no header (alphabetical sorts read better as one flat list)
  label: string | null;
  items: T[];
}

// splits an already-sorted list into month runs. sorting stays the page's
// job, so newest/oldest both just work: a new header starts whenever the
// month changes.
export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string,
  grouped: boolean,
): ListSection<T>[] {
  if (!grouped) return [{ key: "all", label: null, items }];

  const thisYear = new Date().getFullYear();
  const sections: ListSection<T>[] = [];
  for (const item of items) {
    const d = new Date(getDate(item));
    const valid = !Number.isNaN(d.getTime());
    const key = valid ? `${d.getFullYear()}-${d.getMonth()}` : "unknown";
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    const label = valid
      ? d
          .toLocaleDateString(undefined, {
            month: "long",
            ...(d.getFullYear() !== thisYear && { year: "numeric" }),
          })
          .toLowerCase()
      : "undated";
    sections.push({ key, label, items: [item] });
  }
  return sections;
}

export function ListSections<T>({
  sections,
  renderItem,
  getKey,
}: {
  sections: ListSection<T>[];
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}) {
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.key} aria-label={section.label ?? undefined}>
          {section.label && (
            <h2 className="flex items-baseline gap-2 px-2 mb-2 text-[11px] font-black text-stone-400 uppercase tracking-widest">
              {section.label}
              <span className="text-stone-300 tabular-nums">
                {section.items.length}
              </span>
            </h2>
          )}
          <ul className="bg-white rounded-3xl border-2 border-stone-100 shadow-sm overflow-hidden divide-y-2 divide-stone-50">
            {section.items.map((item) => (
              <li key={getKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ─── paging ─────────────────────────────────────────────────────────────────

// replaces the old "load more ⬇️" button: the next page appends on its own
// when the end of the list scrolls into view, and the footer says when
// there's nothing left so the list never just… stops.
export function ListFooter({
  hasMore,
  onLoadMore,
  shown,
  total,
  noun,
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  shown: number;
  total: number;
  noun: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);

  useEffect(() => {
    loadRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // generous rootMargin so the next page is usually in before you reach it
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadRef.current();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  if (total === 0) return null;

  return (
    <div ref={sentinelRef} className="pt-5 pb-2 flex justify-center">
      {hasMore ? (
        // still a real button for keyboard users / if the observer misfires
        <button
          onClick={onLoadMore}
          className="text-[11px] font-black text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors"
        >
          showing {shown} of {total} · show more
        </button>
      ) : (
        <span className="text-[11px] font-black text-stone-300 uppercase tracking-widest">
          {total === 1 ? `1 ${noun}` : `all ${total} ${noun}s`} ✨
        </span>
      )}
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────────

const LEADING_EMOJI = /\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*/u;

const TILE_TINTS = [
  "bg-emerald-50 text-emerald-600",
  "bg-sky-50 text-sky-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-500",
  "bg-violet-50 text-violet-600",
  "bg-teal-50 text-teal-600",
];

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TILE_TINTS[Math.abs(hash) % TILE_TINTS.length];
}

// a trip's tile uses the first emoji in its name ("bali 🌴" → 🌴), falling
// back to its first letter on a stable tint so rows are easy to scan.
function TripTile({ trip }: { trip: Trip }) {
  const emoji = trip.name.match(LEADING_EMOJI)?.[0];
  const letter = trip.name.replace(LEADING_EMOJI, "").trim().charAt(0);
  return (
    <div
      className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-black ${emoji ? "bg-stone-50" : tintFor(trip.id)}`}
      aria-hidden="true"
    >
      {emoji ?? (letter.toUpperCase() || "🎒")}
    </div>
  );
}

export const CATEGORY_EMOJI: Record<string, string> = {
  "food & bev": "🍔",
  shopping: "🛍️",
  transportation: "⛽",
  hotel: "🏨",
  flights: "✈️",
  activities: "🏄",
  other: "✨",
};

function StatusPill({
  isKept,
  retention,
}: {
  isKept?: boolean;
  retention: RetentionInfo;
}) {
  if (isKept) {
    return (
      <span
        className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider text-center lg:min-w-[6.5rem]"
        title="kept forever"
      >
        📌<span className="hidden sm:inline"> kept</span>
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider tabular-nums text-center lg:min-w-[6.5rem] ${retention.isUrgent ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"}`}
      title={retention.label}
    >
      ⏳ <span className="sm:hidden">{retention.tinyLabel}</span>
      <span className="hidden sm:inline">{retention.shortLabel}</span>
    </span>
  );
}

const Chevron = () => (
  <svg
    className="shrink-0 w-4 h-4 text-stone-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const rowClass =
  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group";

// ─── rows ───────────────────────────────────────────────────────────────────

export function TripRow({
  trip,
  isOwner,
  retention,
  onOpen,
}: {
  trip: Trip;
  isOwner: boolean;
  retention: RetentionInfo;
  onOpen: () => void;
}) {
  const memberCount = trip.members?.length ?? 0;
  return (
    <button
      onClick={onOpen}
      className={`${rowClass} hover:bg-stone-50/80 active:bg-stone-100`}
    >
      <TripTile trip={trip} />
      <div className="flex-1 min-w-0">
        <h3 className="font-extrabold text-[15px] text-stone-800 truncate group-hover:text-emerald-700 transition-colors">
          {trip.name}
        </h3>
        <p className="text-xs font-bold text-stone-400 truncate">
          {isOwner ? "you" : trip.owner_name} 👑
          {memberCount > 0 && (
            <>
              {" · "}
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </>
          )}
        </p>
      </div>
      <span className="hidden lg:block shrink-0 w-28 text-right text-xs font-bold text-stone-400 tabular-nums">
        {formatDisplayDate(trip.createdAt).toLowerCase()}
      </span>
      <StatusPill isKept={trip.is_kept} retention={retention} />
      <Chevron />
    </button>
  );
}

// quick splits are always IDR today (see quick-split/page.tsx)
const RECEIPT_CURRENCY = "IDR";

export function ReceiptRow({
  expense,
  retention,
  isSelecting,
  isSelected,
  onOpen,
  onDelete,
  savedFrom,
}: {
  expense: Expense;
  retention: RetentionInfo;
  isSelecting: boolean;
  isSelected: boolean;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  // set when this is someone else's receipt the user bookmarked (3.2): it
  // can't be merged, and the trash button only removes the bookmark.
  savedFrom?: string;
}) {
  const isSaved = savedFrom !== undefined;
  const isLocked = isSelecting && isSaved;
  const emoji = CATEGORY_EMOJI[expense.category || "other"] ?? "🧾";
  const date = formatDisplayDate(expense.expenseDate.replace(" ", "T"), {
    month: "short",
    day: "numeric",
  }).toLowerCase();
  const amount = (
    // muted on purpose: it helps tell receipts apart, but the title should
    // stay the loudest thing in the row
    <span className="shrink-0 text-xs font-bold text-stone-400 tabular-nums">
      <span className="text-stone-300 mr-0.5">
        {getCurrencySymbol(RECEIPT_CURRENCY)}
      </span>
      {formatMoney(expense.totalAmount, RECEIPT_CURRENCY)}
    </span>
  );
  return (
    <button
      onClick={isLocked ? undefined : onOpen}
      disabled={isLocked}
      title={isLocked ? "saved receipts can't be merged" : undefined}
      aria-pressed={isSelecting && !isLocked ? isSelected : undefined}
      className={`${rowClass} ${isLocked ? "opacity-40 cursor-not-allowed" : isSelected ? "bg-emerald-50/70" : "hover:bg-stone-50/80 active:bg-stone-100"}`}
    >
      {isSelecting && !isLocked ? (
        <div
          className={`shrink-0 w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-all ${
            isSelected
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "bg-white border-stone-200 text-transparent"
          }`}
          aria-hidden="true"
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
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      ) : (
        <div
          className="shrink-0 w-11 h-11 rounded-2xl bg-stone-50 flex items-center justify-center text-lg"
          aria-hidden="true"
        >
          {emoji}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-extrabold text-[15px] text-stone-800 truncate group-hover:text-emerald-700 transition-colors">
            {expense.title}
          </h3>
          {isSaved && (
            <span
              className="shrink-0 max-w-[45%] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-100 text-sky-600 text-[10px] font-black"
              title={`saved from ${savedFrom || "someone"}`}
            >
              <svg
                className="w-2.5 h-2.5 shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="truncate">from {savedFrom || "someone"}</span>
            </span>
          )}
        </div>
        {/* phones: date, status and amount share the meta line so the title
            keeps the full width. desktop: they become columns (see below). */}
        <div className="flex items-center gap-1.5 min-w-0 lg:hidden">
          <span className="shrink-0 text-xs font-bold text-stone-400 whitespace-nowrap">
            {date}
          </span>
          <StatusPill isKept={expense.isKept} retention={retention} />
          <span className="ml-auto pl-2">{amount}</span>
        </div>
      </div>
      <span className="hidden lg:block shrink-0 w-20 text-right text-xs font-bold text-stone-400 tabular-nums">
        {date}
      </span>
      <span className="hidden lg:block">
        <StatusPill isKept={expense.isKept} retention={retention} />
      </span>
      <span className="hidden lg:block w-36 text-right">{amount}</span>
      {!isSelecting && (
        <div
          onClick={onDelete}
          role="button"
          tabIndex={0}
          aria-label={
            isSaved
              ? `remove ${expense.title} from my receipts`
              : `delete ${expense.title}`
          }
          title={isSaved ? "remove from my receipts" : "delete"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onDelete(e as unknown as React.MouseEvent);
            }
          }}
          className={`shrink-0 -mr-1 w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-white focus:text-white transition-all lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100 ${isSaved ? "hover:bg-stone-700 focus:bg-stone-700" : "hover:bg-rose-500 focus:bg-rose-500"}`}
        >
          {isSaved ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          )}
        </div>
      )}
    </button>
  );
}
