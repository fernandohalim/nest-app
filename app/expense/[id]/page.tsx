"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAlertStore } from "@/store/useAlertStore";
import { toPng } from "html-to-image";
import { Expense, Member } from "@/lib/types";

const getCurrencySymbol = (currencyCode: string) => {
  const symbols: Record<string, string> = {
    IDR: "Rp",
    SGD: "$",
    MYR: "RM",
    THB: "฿",
    JPY: "¥",
    KRW: "₩",
    AUD: "$",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  return symbols[currencyCode] || currencyCode;
};

// hardcoded barcode widths to avoid react hydration errors with math.random
const BARCODE_WIDTHS = [
  "w-1",
  "w-2",
  "w-0.5",
  "w-1",
  "w-1.5",
  "w-2",
  "w-0.5",
  "w-1.5",
  "w-1",
  "w-2",
  "w-0.5",
  "w-1.5",
  "w-1",
  "w-1",
  "w-2",
  "w-0.5",
  "w-1",
  "w-1.5",
  "w-2",
  "w-0.5",
  "w-1",
];

export default function UnifiedExpensePage() {
  const params = useParams();
  const router = useRouter();
  const expenseId = params.id as string;

  const { showAlert } = useAlertStore();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tripData, setTripData] = useState<{
    id: string;
    name: string;
    currency: string;
    owner_id: string;
    is_collaborative: boolean;
  } | null>(null);

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

      // 🔥 FIX: if there's a trip, fetch the trip members.
      // if it's a quick split (no trip), use the ephemeral members!
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
      await new Promise((resolve) => setTimeout(resolve, 100));

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

    if (navigator.share) {
      try {
        await navigator.share({
          title: `nest: ${expense?.title}`,
          text: `here's the receipt for ${expense?.title} 🧾`,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          navigator.clipboard.writeText(url);
          showAlert("link copied! send it to the group 📱", "copied! 🔗");
        }
      }
    } else {
      // desktop fallback
      navigator.clipboard.writeText(url);
      showAlert("link copied! send it to the group 📱", "copied! 🔗");
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbf7]">
        <div className="relative w-16 h-16 flex items-center justify-center mb-6">
          <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xl animate-pulse">🧾</span>
        </div>
        <p className="text-sm text-stone-500 font-bold tracking-wide">
          pulling up the receipt...
        </p>
      </main>
    );
  }

  if (!expense) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdfbf7] p-6 text-center">
        <div className="text-6xl mb-6 grayscale opacity-50">💨</div>
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
  const isZeroDecimal = ["IDR", "JPY", "KRW"].includes(currencyCode);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const formatMoney = (val: number) =>
    Number(val).toLocaleString("en-US", {
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    });

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || "unknown";

  const itemsSum =
    expense.splitType === "exact" && expense.items
      ? expense.items.reduce((acc, item) => acc + item.price, 0)
      : 0;
  const difference = expense.totalAmount - itemsSum;

  let totalExtraAdjustments = 0;
  if (expense.splitType === "adjustment" && expense.adjustments) {
    totalExtraAdjustments = Object.values(expense.adjustments).reduce(
      (acc, val) => acc + val,
      0,
    );
  }
  const baseAdjustmentSubtotal = expense.totalAmount - totalExtraAdjustments;

  const payersEntries = Object.entries(expense.paidBy);
  const payerDisplay =
    payersEntries.length > 1
      ? "multiple people"
      : getMemberName(payersEntries[0][0]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-6 bg-[#fdfbf7] pb-10 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      {/* top navigation */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <button
          onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get("from") === "quick" || !tripData) {
              router.push("/?tab=quick");
            } else {
              router.back();
            }
          }}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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

        <div className="flex items-center gap-2">
          {!tripData && (
            <button
              onClick={() => router.push(`/quick-split?edit=${expense.id}`)}
              className="px-4 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 font-bold text-sm hover:text-emerald-600 hover:border-emerald-200 active:scale-95 transition-all"
            >
              ✏️ edit receipt
            </button>
          )}

          <button
            onClick={handleShare}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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
                d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-4-6l-4-4m0 0L8 6m4-4v13"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* nest-style trip redirect button */}
      {tripData && (
        <div className="w-full max-w-md mb-6 animate-in slide-in-from-top-4 duration-500 z-10">
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
            <div className="w-10 h-10 shrink-0 rounded-full bg-stone-50 border-2 border-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors">
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

      {/* THE RECEIPT (captured by html-to-image) */}
      <div
        ref={receiptRef}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border-2 border-stone-100 flex flex-col font-sans text-stone-800 animate-in zoom-in-95 duration-500 overflow-hidden relative"
      >
        <div className="p-6 sm:p-8 border-b-2 border-dashed border-stone-200 flex flex-col items-center text-center bg-white relative z-10">
          <div className="text-4xl mb-4">🧾</div>
          <h1 className="text-2xl font-black text-stone-800 leading-tight mb-2">
            {expense.title}
          </h1>
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
            {new Date(expense.expenseDate).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>

        <div className="p-6 sm:p-8 bg-white relative z-10 flex flex-col">
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                paid by
              </span>
              <span className="font-extrabold text-stone-800">
                {payerDisplay}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                category
              </span>
              <span className="font-bold px-2 py-0.5 bg-stone-100 text-stone-500 rounded-md text-[10px] uppercase tracking-widest">
                {expense.category}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-5 mb-8">
            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block border-b-2 border-stone-100 pb-2">
              breakdown by member
            </span>

            <div className="flex flex-col gap-5">
              {Object.entries(expense.owedBy).map(([memberId, finalAmount]) => {
                const memberItems: {
                  name: string;
                  share: number;
                  count: number;
                  totalShares: number;
                }[] = [];
                let baseShareTotal = 0;

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
                      baseShareTotal += shareVal;
                    }
                  });
                }

                const extra = expense.adjustments?.[memberId] || 0;
                const diff = finalAmount - baseShareTotal - extra;

                return (
                  <div key={memberId} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-extrabold text-stone-800 uppercase">
                        {getMemberName(memberId)}
                      </span>
                      <span className="font-black text-stone-800">
                        {currencySymbol} {formatMoney(finalAmount)}
                      </span>
                    </div>

                    {expense.splitType === "exact" &&
                      memberItems.length > 0 && (
                        <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-stone-200 ml-1 mt-1">
                          {memberItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-xs text-stone-500"
                            >
                              <span className="font-bold truncate pr-2">
                                ↳ {item.name}{" "}
                                {item.totalShares > 1
                                  ? `(${item.count}/${item.totalShares})`
                                  : ""}
                              </span>
                              <span className="shrink-0">
                                {currencySymbol} {formatMoney(item.share)}
                              </span>
                            </div>
                          ))}
                          {Math.abs(diff) >= 0.5 && (
                            <div className="flex justify-between text-xs text-stone-500 mt-0.5 pt-1.5 border-t border-stone-100/50">
                              <span className="font-bold uppercase text-[9px] tracking-widest pt-0.5">
                                {diff > 0 ? "tax & tip" : "discount"}
                              </span>
                              <span className="shrink-0">
                                {diff > 0 ? "+" : "-"}
                                {currencySymbol} {formatMoney(Math.abs(diff))}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                    {expense.splitType === "adjustment" && extra !== 0 && (
                      <div className="flex flex-col gap-1 pl-3 border-l-2 border-stone-200 ml-1 mt-1">
                        <div className="flex justify-between text-xs text-stone-500">
                          <span className="font-bold">↳ base split</span>
                          <span>
                            {currencySymbol} {formatMoney(finalAmount - extra)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-stone-500">
                          <span className="font-bold">↳ extra</span>
                          <span>
                            +{currencySymbol} {formatMoney(extra)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full border-t-2 border-stone-200 mb-6 border-dashed"></div>

          <div className="flex flex-col gap-2 mb-6 text-sm">
            {expense.splitType === "exact" && Math.abs(difference) > 0 && (
              <>
                <div className="flex justify-between text-stone-500">
                  <span className="font-bold">subtotal</span>
                  <span className="font-black">
                    {currencySymbol} {formatMoney(itemsSum)}
                  </span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span className="font-bold">
                    {difference > 0 ? "tax & fees" : "discount"}
                  </span>
                  <span className="font-black">
                    {difference > 0 ? "+" : "-"}
                    {currencySymbol} {formatMoney(Math.abs(difference))}
                  </span>
                </div>
              </>
            )}
            {expense.splitType === "adjustment" &&
              totalExtraAdjustments > 0 && (
                <>
                  <div className="flex justify-between text-stone-500">
                    <span className="font-bold">base subtotal</span>
                    <span className="font-black">
                      {currencySymbol} {formatMoney(baseAdjustmentSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span className="font-bold">adjustments</span>
                    <span className="font-black">
                      +{currencySymbol} {formatMoney(totalExtraAdjustments)}
                    </span>
                  </div>
                </>
              )}
          </div>

          <div className="flex justify-between items-end p-5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">
              total
            </span>
            <span className="text-3xl font-black text-emerald-600">
              {currencySymbol} {formatMoney(expense.totalAmount)}
            </span>
          </div>

          <div className="flex flex-col items-center mt-10 pt-6 border-t-2 border-dashed border-stone-200">
            <div className="flex gap-0.75 mb-3 opacity-30 h-10 items-center justify-center">
              {BARCODE_WIDTHS.map((width, i) => (
                <div key={i} className={`h-full bg-stone-800 ${width}`}></div>
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
        className="mt-8 w-full max-w-md py-4.5 bg-stone-900 text-white font-black text-base rounded-2xl shadow-xl hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {isExporting ? (
          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        )}
        save receipt image
      </button>
    </main>
  );
}
