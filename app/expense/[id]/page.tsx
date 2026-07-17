"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAlertStore } from "@/store/useAlertStore";
import { toPng, toBlob } from "html-to-image";
import { Expense, Member } from "@/lib/types";
import { useTripStore } from "@/store/useTripStore";
import LoadingState from "@/components/loading-state";
import { formatMoney, getCurrencySymbol } from "@/lib/format";
import { formatDisplayDateTime } from "@/lib/datetime";
import twemoji from "@twemoji/api";
import Emoji from "@/components/emoji";
import { getAvatarColor } from "@/lib/avatars";

const BARCODE_WIDTHS = [
  4, 8, 2, 4, 6, 8, 2, 6, 4, 8, 2, 6, 4, 4, 8, 2, 4, 6, 8, 2, 4,
];

// the share card's payer chips wrap, so an unbounded payer list grew the card
// without limit. cap it the way the trip card already caps "the crew", and let
// the overflow collapse into a "+N more" chip.
const SHARE_PAYER_LIMIT = 4;

// 2x of the fixed 720x900 frame. lands on 1440x1800 — comfortably past the
// ~1080px clients downscale to, while keeping the file about the same weight
// as the old 3x capture of a narrower card.
const SHARE_PIXEL_RATIO = 2;

export default function UnifiedExpensePage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.id as string;

  const user = useTripStore((s) => s.user);
  const showAlert = useAlertStore((s) => s.showAlert);

  const receiptRef = useRef<HTMLDivElement>(null);
  const shareFrameRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tripData, setTripData] = useState<{
    id: string;
    name: string;
    currency: string;
    owner_id: string;
    is_collaborative: boolean;
  } | null>(null);

  const PAYER_BAR_COLOR_MAP: Record<string, string> = {
    pink: "bg-pink-500",
    purple: "bg-purple-500",
    indigo: "bg-indigo-500",
    sky: "bg-sky-500",
    teal: "bg-teal-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  const getPayerBarColor = (name: string): string => {
    const match = getAvatarColor(name).match(/bg-(\w+)-\d+/);
    return PAYER_BAR_COLOR_MAP[match?.[1] ?? ""] ?? "bg-stone-400";
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: expData, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", expenseId)
        .single();

      if (expError || !expData) {
        setIsLoading(false);
        return;
      }

      const mappedExp: Expense = {
        id: expData.id,
        title: expData.title,
        totalAmount: expData.total_amount,
        paidBy: expData.paid_by,
        owedBy: expData.owed_by,
        splitType: expData.split_type,
        items: expData.items,
        adjustments: expData.adjustments,
        settledShares: expData.settled_shares,
        expenseDate: expData.expense_date,
        createdAt: expData.created_at,
        category: expData.category || "other",
      };
      setExpense(mappedExp);

      if (expData.trip_id) {
        const [tripRes, membersRes] = await Promise.all([
          supabase
            .from("trips")
            .select("id, name, currency, owner_id, is_collaborative")
            .eq("id", expData.trip_id)
            .single(),
          supabase.from("members").select("*").eq("trip_id", expData.trip_id),
        ]);
        if (tripRes.data) setTripData(tripRes.data);
        if (membersRes.data) setMembers(membersRes.data);
      } else if (expData.ephemeral_members) {
        setMembers(expData.ephemeral_members);
      }

      setIsLoading(false);
    };
    fetchData();
  }, [expenseId]);

  const handleExportImage = async () => {
    if (!receiptRef.current) return;
    try {
      setIsExporting(true);

      twemoji.parse(receiptRef.current, {
        callback: (icon: string) => `/emoji/${icon}.svg`,
      });

      await new Promise((resolve) => setTimeout(resolve, 400));

      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#fdfbf7",
      });

      const link = document.createElement("a");
      link.download = `nest-${expense?.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();

      showAlert("receipt saved to your device! 📸", "exported ✨");
    } catch {
      showAlert("couldn't create the image. try again!", "error ❌");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareTitle = `nest: ${expense?.title}`;
    const shareText = `here's the receipt for ${expense?.title} 🧾`;

    try {
      setIsSharing(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      let fileToShare: File | null = null;

      if (shareFrameRef.current) {
        twemoji.parse(shareFrameRef.current, {
          callback: (icon: string) => `/emoji/${icon}.svg`,
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        const blob = await toBlob(shareFrameRef.current, {
          cacheBust: true,
          pixelRatio: SHARE_PIXEL_RATIO,
          backgroundColor: "#fdfbf7",
        });

        if (blob) {
          fileToShare = new File(
            [blob],
            `nest-${expense?.title?.replace(/\s+/g, "-").toLowerCase() || "receipt"}.png`,
            { type: "image/png" },
          );
        }
      }

      const shareData: ShareData = {
        title: shareTitle,
        text: shareText,
        url: url,
      };

      if (
        fileToShare &&
        navigator.canShare &&
        navigator.canShare({ files: [fileToShare] })
      ) {
        shareData.files = [fileToShare];
      }

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error("web share not supported");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        navigator.clipboard.writeText(url);
        showAlert("link copied! send it to the group 📱", "copied! 🔗");
      }
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbf7]">
        <LoadingState label="pulling up the receipt..." />
      </main>
    );
  }

  if (!expense) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbf7] p-6 text-center">
        <div className="text-6xl mb-6 grayscale opacity-50" aria-hidden="true">
          💨
        </div>
        <p className="text-stone-500 font-bold text-sm">
          this receipt doesn&apos;t exist or expired.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 px-6 py-3 bg-white border-2 border-stone-200 rounded-full text-sm text-stone-700 font-bold hover:border-emerald-500 hover:text-emerald-600 hover:-translate-y-1 transition-all shadow-sm"
        >
          ← head back home
        </button>
      </main>
    );
  }

  const currencyCode = tripData?.currency || "IDR";
  const currencySymbol = getCurrencySymbol(currencyCode);

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || "unknown";

  const itemsSum =
    expense.splitType === "exact" && expense.items
      ? expense.items.reduce((acc, item) => acc + item.price, 0)
      : 0;
  const difference = expense.totalAmount - itemsSum;

  const payersEntries = Object.entries(expense.paidBy);

  const isOwner =
    user &&
    !tripData &&
    ((expense.paidBy && expense.paidBy[user.id] !== undefined) ||
      (expense.owedBy && expense.owedBy[user.id] !== undefined) ||
      members.some((m) => m.id === user.id));

  const isQuickSplit = !tripData;
  const createdAtMs = new Date(expense.createdAt).getTime();
  const daysSinceCreated = Math.floor(
    (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24),
  );
  const daysLeft = Math.max(0, 7 - daysSinceCreated);
  const isExpiringSoon = isQuickSplit && daysLeft <= 2;

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 bg-[#fdfbf7] pb-10 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md lg:max-w-4xl flex justify-between items-center mb-6">
        <button
          onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("from") === "quick" || !tripData) {
              router.push("/?tab=quick");
            } else {
              router.back();
            }
          }}
          aria-label="back"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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

        <div className="flex items-center gap-2">
          {!tripData && isOwner && (
            <button
              onClick={() => router.push(`/quick-split?edit=${expense.id}`)}
              aria-label="edit receipt"
              className="px-4 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 font-bold text-sm hover:text-emerald-600 hover:border-emerald-200 active:scale-95 transition-all"
            >
              edit receipt
            </button>
          )}

          {tripData && (
            <button
              onClick={() =>
                router.push(`/trip/${tripData.id}?openExpense=${expense.id}`)
              }
              aria-label="edit in trip"
              className="px-4 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 font-bold text-sm hover:text-emerald-600 hover:border-emerald-200 active:scale-95 transition-all"
            >
              edit in trip
            </button>
          )}

          <button
            onClick={handleShare}
            disabled={isSharing}
            aria-label="share receipt"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100 disabled:active:scale-100"
          >
            {isSharing ? (
              <div
                className="w-5 h-5 border-2 border-stone-200 border-t-emerald-500 rounded-full animate-spin"
                aria-hidden="true"
              ></div>
            ) : (
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
                  d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-4-6l-4-4m0 0L8 6m4-4v13"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* desktop: receipt on the left, its meta (expiry / linked trip) in a
          side rail. the contents-wrappers keep the mobile stack byte-identical. */}
      <div className="w-full max-w-md lg:max-w-4xl lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:col-start-2 lg:row-start-1">
      {isQuickSplit && (
        <div
          className={`w-full max-w-md lg:max-w-none mb-6 lg:mb-0 animate-in slide-in-from-top-4 duration-500 z-10 rounded-2xl border-2 p-4 flex items-center gap-3 shadow-sm ${
            isExpiringSoon
              ? "bg-rose-50 border-rose-200"
              : "bg-amber-50 border-amber-100"
          }`}
        >
          <div
            className={`text-2xl shrink-0 ${isExpiringSoon ? "animate-pulse" : ""}`}
            aria-hidden="true"
          >
            {isExpiringSoon ? "⚠️" : "⏳"}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span
              className={`text-[11px] font-black tracking-widest uppercase leading-none ${
                isExpiringSoon ? "text-rose-800" : "text-amber-800"
              }`}
            >
              {daysLeft === 0
                ? "expires today"
                : `expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
            </span>
            <span
              className={`text-[10px] font-bold mt-1 tracking-wider ${
                isExpiringSoon ? "text-rose-600" : "text-amber-600"
              }`}
            >
              quick splits self-destruct after 7 days. save the image to keep
              it.
            </span>
          </div>
        </div>
      )}

      {tripData && (
        <div className="w-full max-w-md lg:max-w-none mb-6 lg:mb-0 animate-in slide-in-from-top-4 duration-500 z-10">
          <button
            onClick={() => router.push(`/trip/${tripData.id}`)}
            className="w-full bg-white border-2 border-stone-100 rounded-3xl p-5 flex items-center justify-between shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group active:scale-[0.98]"
          >
            <div className="flex flex-col text-left min-w-0 pr-4">
              <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-1">
                associated trip 🎒
              </span>
              <span className="text-xl font-extrabold text-stone-800 truncate">
                {tripData.name}
              </span>
            </div>
            <div
              className="w-10 h-10 shrink-0 rounded-full bg-stone-50 border-2 border-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors"
              aria-hidden="true"
            >
              <svg
                className="w-5 h-5 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>
      )}

        </div>
        {/* receipt + save — the main column on desktop */}
        <div className="contents lg:flex lg:flex-col lg:col-start-1 lg:row-start-1">
      {/* THE RECEIPT (captured by html-to-image) */}
      <div
        ref={receiptRef}
        className="w-full max-w-md lg:max-w-none bg-white rounded-3xl shadow-xl border-2 border-stone-100 flex flex-col font-sans text-stone-800 animate-in zoom-in-95 duration-500 overflow-hidden relative"
      >
        {/* HEADER */}
        <div className="p-6 sm:p-8 border-b-2 border-dashed border-stone-200 flex flex-col items-center text-center bg-white relative z-10">
          <div className="text-4xl mb-4" aria-hidden="true">
            <Emoji char="🧾" />
          </div>
          <h1 className="text-2xl font-black text-stone-800 leading-tight mb-2">
            {expense.title}
          </h1>
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
            {formatDisplayDateTime(expense.expenseDate)}
          </p>
          <span className="mt-3 font-bold px-3 py-1 bg-stone-50 border border-stone-100 text-stone-400 rounded-full text-[10px] uppercase tracking-widest">
            {expense.category}
          </span>
        </div>

        <div className="p-6 sm:p-8 bg-white relative z-10 flex flex-col">
          {/* SECTION 1: THE ORDER (Only for exact splits with items) */}
          {expense.splitType === "exact" &&
            expense.items &&
            expense.items.length > 0 && (
              <div className="flex flex-col gap-4 mb-8">
                <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest border-b-2 border-stone-100 pb-2">
                  the order
                </span>
                <div className="flex flex-col gap-4">
                  {expense.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-start text-sm">
                        <span className="font-extrabold text-stone-800 pr-4 leading-tight">
                          {item.name}
                        </span>
                        <span className="font-black text-stone-800 shrink-0">
                          {currencySymbol}
                          {formatMoney(item.price, currencyCode)}
                        </span>
                      </div>
                      {item.assignedTo.length > 0 && (
                        <div className="text-[11px] font-bold text-stone-400 leading-snug">
                          item by:{" "}
                          {Array.from(new Set(item.assignedTo))
                            .map((id) => getMemberName(id))
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* SECTION 2: THE MATH */}
          <div className="flex flex-col gap-3 mb-8">
            <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest border-b-2 border-stone-100 pb-2">
              totals
            </span>

            {expense.splitType === "exact" && Math.abs(difference) > 0 && (
              <>
                <div className="flex justify-between text-sm text-stone-500">
                  <span className="font-bold">subtotal</span>
                  <span className="font-black">
                    {currencySymbol}
                    {formatMoney(itemsSum, currencyCode)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-stone-500">
                  <span className="font-bold">
                    {difference > 0 ? "tax & fees" : "discount"}
                  </span>
                  <span className="font-black">
                    {difference > 0 ? "+" : "-"}
                    {currencySymbol}
                    {formatMoney(Math.abs(difference), currencyCode)}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-end mt-2 p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl">
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">
                total
              </span>
              <span className="text-3xl font-black text-emerald-600">
                {currencySymbol}
                {formatMoney(expense.totalAmount, currencyCode)}
              </span>
            </div>
          </div>

          {/* SECTION 3: THE SETTLEMENT */}
          <div className="flex flex-col gap-4 bg-stone-50 rounded-2xl p-5 border-2 border-stone-100">
            <div
              className={`flex text-sm border-b-2 border-stone-200/60 pb-4 mb-2 ${
                payersEntries.length === 1
                  ? "justify-between items-center gap-4"
                  : "flex-col items-start gap-3"
              }`}
            >
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest shrink-0">
                paid by
              </span>

              {payersEntries.length === 1 ? (
                <div className="font-extrabold text-stone-800 bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-sm leading-none">
                  {getMemberName(payersEntries[0][0])}
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full">
                  {/* proportion bar */}
                  <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-stone-100 shadow-inner">
                    {payersEntries.map(([memberId, amount]) => {
                      const name = getMemberName(memberId);
                      const pct = (amount / expense.totalAmount) * 100;
                      return (
                        <div
                          key={memberId}
                          className={getPayerBarColor(name)}
                          style={{ width: `${pct}%` }}
                          title={`${name} • ${pct.toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>

                  {/* legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {payersEntries.map(([memberId, amount]) => {
                      const name = getMemberName(memberId);
                      const pct = (amount / expense.totalAmount) * 100;
                      return (
                        <div
                          key={memberId}
                          className="flex items-center gap-1.5 text-xs leading-none"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${getPayerBarColor(name)}`}
                            aria-hidden="true"
                          />
                          <span className="font-extrabold text-stone-700">
                            {name}
                          </span>
                          <span className="font-bold text-stone-400">
                            {currencySymbol}
                            {formatMoney(amount, currencyCode)}
                          </span>
                          <span className="font-bold text-stone-300 text-[10px]">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
                split breakdown
              </span>
              {Object.entries(expense.owedBy).map(([memberId, finalAmount]) => {
                let baseShareTotal = 0;
                const memberItems: {
                  name: string;
                  share: number;
                  count: number;
                  totalShares: number;
                }[] = [];

                // Calculate their raw food cost
                if (expense.splitType === "exact" && expense.items) {
                  expense.items.forEach((item) => {
                    const myShares = item.assignedTo.filter(
                      (id) => id === memberId,
                    ).length;
                    if (myShares > 0) {
                      const shareVal =
                        (item.price / item.assignedTo.length) * myShares;
                      memberItems.push({
                        name: item.name,
                        share: shareVal,
                        count: myShares,
                        totalShares: item.assignedTo.length,
                      });
                      baseShareTotal += shareVal; // Keep track of the raw cost!
                    }
                  });
                }

                // 🔥 NEW: Find their exact slice of the tax/tip/discount
                const exactDiff =
                  expense.splitType === "exact"
                    ? finalAmount - baseShareTotal
                    : 0;
                const adjustmentExtra =
                  expense.splitType === "adjustment"
                    ? expense.adjustments?.[memberId] || 0
                    : 0;

                return (
                  <div
                    key={memberId}
                    className="flex flex-col gap-1.5 border-b border-stone-200/50 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-extrabold text-stone-700">
                        {getMemberName(memberId)}
                      </span>
                      <span className="font-black text-stone-800">
                        {currencySymbol}
                        {formatMoney(finalAmount, currencyCode)}
                      </span>
                    </div>

                    {/* Render the specific items they consumed + their tax slice */}
                    {(memberItems.length > 0 ||
                      Math.abs(exactDiff) > 0.005) && (
                      <div className="flex flex-col gap-1 pl-3 mt-1 border-l-2 border-stone-200/80">
                        {memberItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-[11px] text-stone-500 gap-2"
                          >
                            <span className="font-bold leading-tight flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="truncate">↳ {item.name}</span>
                              {item.totalShares > 1 && (
                                <span className="text-[9px] font-black text-stone-500 bg-stone-100 border border-stone-200/60 px-1.5 py-0.5 rounded-md shrink-0 tabular-nums leading-none">
                                  {item.count}/{item.totalShares}
                                </span>
                              )}
                            </span>
                            <span className="font-bold shrink-0 tabular-nums">
                              {currencySymbol}
                              {formatMoney(item.share, currencyCode)}
                            </span>
                          </div>
                        ))}

                        {/* 🔥 NEW: Display their personal share of tax/tip/discount */}
                        {expense.splitType === "exact" &&
                          Math.abs(exactDiff) > 0.005 && (
                            <div className="flex justify-between items-start text-[11px] text-stone-400 mt-0.5 pt-1 border-t border-stone-200/50">
                              <span className="font-bold uppercase text-[9px] tracking-widest pt-0.5">
                                {exactDiff > 0 ? "↳ tax & fees" : "↳ discount"}
                              </span>
                              <span className="font-bold shrink-0">
                                {exactDiff > 0 ? "+" : "-"}
                                {currencySymbol}
                                {formatMoney(Math.abs(exactDiff), currencyCode)}
                              </span>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Adjustments text if applicable */}
                    {expense.splitType === "adjustment" &&
                      adjustmentExtra !== 0 && (
                        <span className="text-[10px] font-bold text-stone-400 text-right mt-1">
                          (includes {adjustmentExtra > 0 ? "+" : "-"}
                          {currencySymbol}
                          {formatMoney(Math.abs(adjustmentExtra), currencyCode)}
                          )
                        </span>
                      )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex flex-col items-center mt-10 pt-6 border-t-2 border-dashed border-stone-200">
            <div
              className="flex mb-3 opacity-30 h-10 items-center justify-center"
              style={{ gap: "3px" }}
              aria-hidden="true"
            >
              {BARCODE_WIDTHS.map((width, i) => (
                <div
                  key={i}
                  className="h-full bg-stone-800"
                  style={{ width: `${width}px` }}
                ></div>
              ))}
            </div>
            <span className="text-[10px] font-mono text-stone-400 tracking-[0.3em]">
              REF-{expense.id.split("-")[0].toUpperCase()}
            </span>
            <span className="mt-4 text-[10px] font-black text-stone-300 uppercase tracking-widest">
              powered by nest.
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleExportImage}
        disabled={isExporting}
        aria-label="save receipt as image"
        className="mt-8 w-full max-w-md lg:max-w-none py-4.5 bg-stone-900 text-white font-black text-base rounded-2xl shadow-xl hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {isExporting ? (
          <div
            className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          ></div>
        ) : (
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        save receipt image
      </button>
        </div>
      </div>

      {/* off-screen receipt snapshot for exporting.
          the frame is fixed at 720x900 (4:5) and is what gets captured, so the
          png is byte-identical in size for every receipt — messengers can't
          crop what already fits. the card floats centred inside it: a short
          receipt just gets more green around it rather than a shorter image.
          everything variable below is hard-capped so the card can never grow
          past the frame and clip. */}
      <div className="overflow-hidden absolute -left-2499.75 top-0 pointer-events-none">
        <div
          ref={shareFrameRef}
          className="w-[720px] h-[900px] bg-emerald-50 flex items-center justify-center relative font-sans overflow-hidden"
        >
          {/* decorative background blobs — on the frame, so they hug the
              image's corners. sized to still read as corner accents now that
              the card covers most of the canvas. */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-200/40 rounded-bl-full mix-blend-multiply"></div>
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-200/40 rounded-tr-full mix-blend-multiply"></div>

          <div className="w-[620px] bg-white border-2 border-emerald-100 rounded-[3rem] p-12 shadow-xl relative z-10 flex flex-col items-center text-center">
            {/* icon */}
            <div className="w-20 h-20 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
              <Emoji char="🧾" className="h-10! w-10!" />
            </div>

            {/* title — clamped: an unbounded title is one of the two things
                that used to make this card's height unpredictable */}
            <h1 className="text-4xl font-black text-stone-800 leading-tight mb-3 line-clamp-2">
              {expense.title}
            </h1>

            {/* meta: category and date share one row. stacked, they cost ~90px
                of height and left the card's width unused — the 4:5 canvas has
                width to spare and height to save. */}
            <div className="flex items-center justify-center gap-2.5 mb-8">
              <span className="font-bold px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] uppercase tracking-widest border border-emerald-100">
                {expense.category}
              </span>
              <span className="font-bold text-stone-400 text-[11px] uppercase tracking-widest">
                {formatDisplayDateTime(expense.expenseDate)}
              </span>
            </div>

            {/* hero amount. the type stops at text-6xl on purpose: idr totals
                run long, and a 9-figure amount at text-7xl overflows the
                block. this size clears 11 digits with room. */}
            <div className="w-full bg-[#fdfbf7] rounded-3xl p-8 mb-6 border-2 border-stone-100 shadow-inner">
              <span className="text-xs font-black text-stone-400 uppercase tracking-widest block mb-2">
                total expense
              </span>
              <span className="text-6xl font-black text-emerald-500 flex items-start justify-center">
                <span className="text-3xl mt-2 mr-1.5">{currencySymbol}</span>
                {formatMoney(expense.totalAmount, currencyCode)}
              </span>
            </div>

            {/* math breakdown & paid by */}
            <div className="w-full flex flex-col items-center gap-4 mb-8">
              {/* subtotal / adjustments (only shows if there's a difference) */}
              {expense.splitType === "exact" && Math.abs(difference) > 0 && (
                <div className="w-full flex flex-col gap-2.5 bg-stone-50 p-5 rounded-2xl border border-stone-100">
                  <div className="flex justify-between text-sm font-bold text-stone-500">
                    <span>subtotal</span>
                    <span className="text-stone-700">
                      {currencySymbol}
                      {formatMoney(itemsSum, currencyCode)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-stone-500">
                    <span>{difference > 0 ? "tax & fees" : "discount"}</span>
                    <span className="text-stone-700">
                      {difference > 0 ? "+" : "-"}
                      {currencySymbol}
                      {formatMoney(Math.abs(difference), currencyCode)}
                    </span>
                  </div>
                </div>
              )}

              {/* paid by chips */}
              <div className="mt-2 flex flex-col items-center w-full">
                <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-3">
                  paid by
                </span>
                <div className="flex flex-wrap gap-2 justify-center">
                  {payersEntries.slice(0, SHARE_PAYER_LIMIT).map(([id, amt]) => (
                    <span
                      key={id}
                      className="text-sm font-extrabold bg-stone-100 border border-stone-200/60 text-stone-500 px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      {getMemberName(id)}
                      {payersEntries.length > 1 && (
                        <span className="text-stone-400">
                          ({currencySymbol}
                          {formatMoney(amt, currencyCode)})
                        </span>
                      )}
                    </span>
                  ))}
                  {payersEntries.length > SHARE_PAYER_LIMIT && (
                    <span className="text-sm font-extrabold bg-stone-100 border border-stone-200/60 text-stone-400 px-3.5 py-2 rounded-xl">
                      +{payersEntries.length - SHARE_PAYER_LIMIT} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full border-t-2 border-dashed border-stone-200 mb-6"></div>

            <span className="text-xs font-black text-emerald-600/40 uppercase tracking-widest">
              powered by nest.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
