"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { v4 as uuidv4 } from "uuid";
import ExpenseForm from "@/components/expense-form";
import { calculateSettlements } from "@/lib/settlements";
import { Expense, ExpenseItem } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import CustomSelect from "@/components/custom-select";
import CameraScanner from "@/components/camera-scanner";
import MemberModal from "@/components/member-modal";
import TripSettingsModal from "@/components/trip-settings-modal";
import SettlementModal from "@/components/settlement-modal";
import LoadingState from "@/components/loading-state";
import ScanningOverlay, { ScanStage } from "@/components/scanning-overlay";
import {
  formatMoney,
  getCurrencySymbol,
  isZeroDecimalCurrency,
} from "@/lib/format";
import { formatDisplayDateTime, timeAgo } from "@/lib/datetime";
import { getAvatarColor, getInitials } from "@/lib/avatars";
import { toBlob } from "html-to-image";
import twemoji from "@twemoji/api";
import Emoji from "@/components/emoji";

export { getCurrencySymbol };

export default function TripDetail() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const showAlert = useAlertStore((s) => s.showAlert);
  const showConfirm = useAlertStore((s) => s.showConfirm);

  const user = useTripStore((s) => s.user);
  const trips = useTripStore((s) => s.trips);
  const addExpense = useTripStore((s) => s.addExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const deleteExpense = useTripStore((s) => s.deleteExpense);
  const toggleExpenseSettled = useTripStore((s) => s.toggleExpenseSettled);
  const fetchTrip = useTripStore((s) => s.fetchTrip);
  const subscribeToTrip = useTripStore((s) => s.subscribeToTrip);
  const toggleCollaborative = useTripStore((s) => s.toggleCollaborative);
  const isLoading = useTripStore((s) => s.isLoading);
  const isSyncing = useTripStore((s) => s.isSyncing);

  const trip = trips.find((t) => t.id === tripId);
  const lastActive = new Date(
    trip?.updatedAt || trip?.createdAt || Date.now(),
  ).getTime();
  const daysSinceActive = Math.floor(
    (Date.now() - lastActive) / (1000 * 60 * 60 * 24),
  );
  const daysLeft = Math.max(0, 7 - daysSinceActive);

  const currencyCode = trip?.currency || "IDR";
  const currencySymbol = getCurrencySymbol(currencyCode);

  const isOwner = Boolean(
    user?.id && trip?.owner_id && user.id === trip.owner_id,
  );
  const canEdit = isOwner || (trip?.is_collaborative ?? false);

  useEffect(() => {
    fetchTrip(tripId);
    const unsubscribe = subscribeToTrip(tripId);
    return () => unsubscribe();
  }, [tripId, fetchTrip, subscribeToTrip]);

  useEffect(() => {
    if (!trip) return;
    const params = new URLSearchParams(window.location.search);
    const targetExpenseId = params.get("openExpense");
    if (!targetExpenseId) return;

    const expense = trip.expenses.find((e) => e.id === targetExpenseId);
    if (expense && canEdit && trip.status !== "finished") {
      setEditingExpense(expense);
      setIsAddingExpense(true);
      // clean the URL so a refresh doesn't re-open the modal
      const url = new URL(window.location.href);
      url.searchParams.delete("openExpense");
      router.replace(`/trip/${tripId}`, { scroll: false });
    }
  }, [trip, canEdit, router, tripId]);

  const getMemberName = (id: string) =>
    trip?.members.find((m) => m.id === id)?.name || "unknown";

  // Modal States
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Expense States
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(
    undefined,
  );
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  // 🔥 finding #3: which expense's payer breakdown sheet is open
  const [payerBreakdownExpense, setPayerBreakdownExpense] =
    useState<Expense | null>(null);

  // Scanner States
  const [showScanner, setShowScanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanStage, setScanStage] = useState<ScanStage>("idle");

  // UI Toggles
  const [showLedger, setShowLedger] = useState(false);
  type SortOption = "newest" | "oldest" | "amount_high" | "amount_low";
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedLedgerMemberId, setExpandedLedgerMemberId] = useState<
    string | null
  >(null);
  const [expandedOwedKey, setExpandedOwedKey] = useState<string | null>(null);
  const [settledRevealed, setSettledRevealed] = useState<Set<string>>(
    new Set(),
  );
  const [isLinked, setIsLinked] = useState(false);

  const processedExpenses = useMemo(
    () =>
      (trip?.expenses || [])
        .filter(
          (exp) => filterCategory === "all" || exp.category === filterCategory,
        )
        .sort((a, b) => {
          if (sortBy === "newest")
            return (
              new Date(b.expenseDate).getTime() -
              new Date(a.expenseDate).getTime()
            );
          if (sortBy === "oldest")
            return (
              new Date(a.expenseDate).getTime() -
              new Date(b.expenseDate).getTime()
            );
          if (sortBy === "amount_high") return b.totalAmount - a.totalAmount;
          if (sortBy === "amount_low") return a.totalAmount - b.totalAmount;
          return 0;
        }),
    [trip?.expenses, filterCategory, sortBy],
  );

  const usedCategories = useMemo(
    () =>
      Array.from(
        new Set((trip?.expenses || []).map((e) => e.category || "other")),
      ),
    [trip?.expenses],
  );

  useEffect(() => {
    if (!user || !trip || isOwner) return;
    const checkLink = async () => {
      const { data } = await supabase
        .from("user_trips")
        .select("*")
        .eq("user_id", user.id)
        .eq("trip_id", tripId)
        .single();
      if (data) setIsLinked(true);
    };
    checkLink();
  }, [user, trip, tripId, isOwner]);

  const handleToggleBookmark = async () => {
    if (!user) return router.push("/login");
    if (isLinked) {
      await supabase
        .from("user_trips")
        .delete()
        .match({ user_id: user.id, trip_id: tripId });
      setIsLinked(false);
      showAlert("removed from your dashboard.", "unlinked 🔗");
    } else {
      await supabase
        .from("user_trips")
        .insert({ user_id: user.id, trip_id: tripId });
      setIsLinked(true);
      showAlert(
        "saved to your dashboard! you can now access it easily.",
        "linked ✨",
      );
    }
  };

  const handleShare = async () => {
    if (!trip) return;
    const url = window.location.href;
    const shareTitle = `nest: ${trip.name}`;
    const shareText = `check out our trip titled: ${trip.name} 🎒`;

    try {
      setIsSharing(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      let fileToShare: File | null = null;

      if (shareCardRef.current) {
        twemoji.parse(shareCardRef.current, {
          callback: (icon: string) => `/emoji/${icon}.svg`,
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        const blob = await toBlob(shareCardRef.current, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#fdfbf7",
        });

        if (blob) {
          fileToShare = new File(
            [blob],
            `nest-trip-${trip.name.replace(/\s+/g, "-").toLowerCase()}.png`,
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

  const handleSmartBack = () => {
    if (typeof window !== "undefined") {
      if (document.referrer.includes(window.location.host)) {
        router.back();
      } else {
        router.push("/");
      }
    }
  };

  const handleSaveExpense = async (expense: Expense) => {
    const exists = trip?.expenses.some((e) => e.id === expense.id);
    if (exists) {
      await updateExpense(tripId, expense.id, expense);
    } else {
      await addExpense(tripId, expense);
    }
    setIsAddingExpense(false);
    setEditingExpense(undefined);
  };

  // 🔥 U5 follow-through: severity is explicit, not inferred from title.
  const handleDeleteExpense = (expenseId: string) => {
    showConfirm(
      "delete this expense permanently? it will recalculate everything.",
      () => {
        deleteExpense(tripId, expenseId);
        setExpandedExpenseId(null);
      },
      {
        title: "delete expense? 🗑️",
        confirmText: "yes, delete it",
        severity: "destructive",
      },
    );
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  // 🔥 L5 helper: validate the Gemini response shape before trusting it.
  // The edge function returns { items: [{name, price}, ...], totalAmount?, ... }
  // but if the model hallucinates or the function errors mid-stream we could
  // get partial / malformed data. Treating it as untrusted input.
  type ScanResponse = {
    items: Array<{ name: string; price: number }>;
    totalAmount?: number;
    merchantName?: string;
    date?: string;
    category?: string;
  };

  const isValidScanResponse = (data: unknown): data is ScanResponse => {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.items)) return false;
    for (const item of d.items) {
      if (!item || typeof item !== "object") return false;
      const it = item as Record<string, unknown>;
      if (typeof it.name !== "string") return false;
      if (typeof it.price !== "number" || !isFinite(it.price)) return false;
    }
    return true;
  };

  const processReceiptFile = async (file: File) => {
    setScanStage("uploading");

    try {
      const base64Data = await fileToBase64(file);
      setScanStage("reading");

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const clientLocalTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: base64Data, mimeType: file.type, clientLocalTime },
      });

      if (error || data?.error) throw new Error("failed to scan");

      // 🔥 L5: validate before consuming
      if (!isValidScanResponse(data)) {
        throw new Error("invalid scan response shape");
      }

      setScanStage("extracting");

      const formattedItems: ExpenseItem[] = data.items.map((item) => ({
        id: uuidv4(),
        name: item.name,
        price: item.price,
        assignedTo: [],
      }));

      const totalScannedAmount =
        data.totalAmount ??
        formattedItems.reduce((sum, item) => sum + item.price, 0);

      const scannedExpense: Expense = {
        id: uuidv4(),
        title: data.merchantName
          ? `📝 ${data.merchantName}`
          : "📝 scanned receipt",
        totalAmount: totalScannedAmount,
        paidBy: { [user!.id]: totalScannedAmount },
        owedBy: {},
        splitType: "exact",
        items: formattedItems,
        expenseDate: data.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        category: data.category || "other",
      };

      setEditingExpense(scannedExpense);
      setIsAddingExpense(true);
    } catch {
      showAlert(
        "couldn't read that receipt, try another one!",
        "scan failed ❌",
      );
    } finally {
      setScanStage("idle");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processReceiptFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const settlements = useMemo(
    () => (trip ? calculateSettlements(trip) : []),
    [trip],
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 🔥 L11 + L2: memoized ledger math. The L2 fix is applied surgically in
  // two spots below — settled-share crediting now distributes proportionally
  // across all payers instead of dumping the full settled amount onto the
  // first payer in paid_by. This matters for multi-payer expenses where the
  // current UI/store now blocks toggling settled (Batch 2 guard), but
  // pre-existing data with settled multi-payer rows is still calculated
  // correctly with this fix.
  //
  // I'm intentionally keeping this inline rather than calling getMemberLedger
  // because SettlementModal consumes the resulting shape and I want to avoid
  // any silent shape drift. Consolidation can happen in a focused later pass.
  // ──────────────────────────────────────────────────────────────────────────
  type LedgerItemRow = {
    name: string;
    share: string | null; // "1/2", "2/3"
    price: number;
  };

  type LedgerCallout = {
    kind: "tax" | "discount" | "adjustment";
    label: string;
    amount: number; // signed
  };

  type RichPaidItem = {
    title: string;
    amount: number;
    isNegative?: boolean;
    // rich fields
    expenseDate?: string;
    totalExpense?: number;
    payerCount?: number;
    fromName?: string;
  };

  type RichOwedItem = {
    title: string;
    amount: number;
    subItems?: string[];
    extra?: number;
    isSettled?: boolean;
    originalAmount?: number;
    // rich fields
    expenseDate?: string;
    totalExpense?: number;
    paidByList?: { name: string; amount: number }[];
    splitType?: "exact" | "equal" | "adjustment";
    itemRows?: LedgerItemRow[];
    callouts?: LedgerCallout[];
    baseAmount?: number;
    memberCount?: number;
  };

  type MemberDetail = {
    totalPaid: number;
    totalOwed: number;
    paidItems: RichPaidItem[];
    owedItems: RichOwedItem[];
  };

  const memberDetails = useMemo(() => {
    const result: Record<string, MemberDetail> = {};
    if (!trip) return result;

    trip.members.forEach((m) => {
      result[m.id] = {
        totalPaid: 0,
        totalOwed: 0,
        paidItems: [],
        owedItems: [],
      };
    });

    trip.expenses.forEach((exp) => {
      const payerCount = Object.keys(exp.paidBy || {}).length;
      const memberCount = Object.keys(exp.owedBy || {}).length;

      Object.entries(exp.paidBy || {}).forEach(([pId, pAmt]) => {
        if (result[pId]) {
          result[pId].totalPaid += pAmt;
          result[pId].paidItems.push({
            title: exp.title,
            amount: pAmt,
            expenseDate: exp.expenseDate,
            totalExpense: exp.totalAmount,
            payerCount,
          });
        }
      });

      const paidByList = Object.entries(exp.paidBy || {})
        .map(([id, amt]) => ({ name: getMemberName(id), amount: amt }))
        .sort((a, b) => b.amount - a.amount);

      Object.entries(exp.owedBy || {}).forEach(([id, amt]) => {
        if (!result[id] || amt <= 0) return;

        result[id].totalOwed += amt;
        const isSettled = exp.settledShares?.[id] || false;

        const itemRows: LedgerItemRow[] = [];
        const callouts: LedgerCallout[] = [];
        const subItems: string[] = [];
        let baseAmount = 0;
        let originalSum = 0;

        if (exp.splitType === "exact" && exp.items) {
          const myItems = exp.items.filter((i) => i.assignedTo.includes(id));
          myItems.forEach((i) => {
            const userShares = i.assignedTo.filter((u) => u === id).length;
            const totalShares = i.assignedTo.length;
            const share =
              totalShares > 1 ? `${userShares}/${totalShares}` : null;
            const myBaseShare = (i.price / totalShares) * userShares;
            baseAmount += myBaseShare;
            originalSum += myBaseShare;
            itemRows.push({ name: i.name, share, price: myBaseShare });

            const shareText = share ? ` (${share})` : "";
            subItems.push(
              `${i.name}${shareText} • ${formatMoney(myBaseShare, currencyCode)}`,
            );
          });

          const itemsSum = exp.items.reduce((s, i) => s + i.price, 0);
          const difference = exp.totalAmount - itemsSum;
          if (Math.abs(difference) > 0) {
            const extra = exp.adjustments?.[id] || 0;
            const diffShare = amt - baseAmount - extra;
            if (Math.abs(diffShare) >= 0.5) {
              callouts.push({
                kind: difference > 0 ? "tax" : "discount",
                label: difference > 0 ? "tax & tip" : "group discount",
                amount: diffShare,
              });
              subItems.push(
                `${difference > 0 ? "tax & tip" : "global discount"} • ${diffShare > 0 ? "+" : "-"}${formatMoney(Math.abs(diffShare), currencyCode)}`,
              );
            }
          }
        } else if (exp.splitType === "adjustment") {
          const extra = exp.adjustments?.[id] || 0;
          baseAmount = amt - extra;
          if (extra > 0) {
            subItems.push(
              `debt after split • ${formatMoney(amt - extra, currencyCode)}`,
            );
            subItems.push(
              `adjusted bill • +${formatMoney(extra, currencyCode)}`,
            );
          }
        } else {
          baseAmount = amt - (exp.adjustments?.[id] || 0);
        }

        const adjExtra = exp.adjustments?.[id] || 0;
        if (adjExtra && exp.splitType !== "adjustment") {
          callouts.push({
            kind: "adjustment",
            label: "manual adjustment",
            amount: adjExtra,
          });
        } else if (adjExtra && exp.splitType === "adjustment") {
          callouts.push({
            kind: "adjustment",
            label: "manual adjustment",
            amount: adjExtra,
          });
        }

        result[id].owedItems.push({
          title: exp.title,
          amount: amt,
          subItems: subItems.length > 0 ? subItems : undefined,
          extra: exp.adjustments?.[id],
          isSettled,
          originalAmount: originalSum > 0 ? originalSum : undefined,
          expenseDate: exp.expenseDate,
          totalExpense: exp.totalAmount,
          paidByList,
          splitType: exp.splitType,
          itemRows,
          callouts,
          baseAmount,
          memberCount,
        });

        if (isSettled) {
          result[id].totalPaid += amt;
          result[id].paidItems.push({
            title: `✓ settled ${exp.title}`,
            amount: amt,
            expenseDate: exp.expenseDate,
            totalExpense: exp.totalAmount,
            payerCount,
          });

          const totalPaidBy = Object.values(exp.paidBy || {}).reduce(
            (s, v) => s + v,
            0,
          );
          if (totalPaidBy > 0) {
            Object.entries(exp.paidBy || {}).forEach(([payerId, payerAmt]) => {
              if (!result[payerId]) return;
              const share = (payerAmt / totalPaidBy) * amt;
              if (share <= 0) return;
              result[payerId].totalPaid -= share;
              result[payerId].paidItems.push({
                title: `received from ${getMemberName(id)} for ${exp.title}`,
                amount: -share,
                isNegative: true,
                expenseDate: exp.expenseDate,
                totalExpense: exp.totalAmount,
                fromName: getMemberName(id),
              });
            });
          }
        }
      });
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, currencyCode]);

  const totalTripCost = useMemo(
    () => trip?.expenses.reduce((sum, exp) => sum + exp.totalAmount, 0) || 0,
    [trip?.expenses],
  );

  if (isLoading && !trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7]">
        <LoadingState />
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7]">
        <div className="text-6xl mb-6 grayscale opacity-50" aria-hidden="true">
          🪹
        </div>
        <p className="text-sm text-stone-500 font-bold">
          hmm, couldn&apos;t find this trip.
        </p>
        <button
          onClick={handleSmartBack}
          className="mt-6 px-6 py-3 bg-white border-2 border-stone-200 rounded-full text-sm text-stone-700 font-bold hover:border-emerald-500 hover:text-emerald-600 hover:-translate-y-1 transition-all shadow-sm"
        >
          ← head back home
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-40 text-stone-800 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* top navigation */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={handleSmartBack}
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
            {!isOwner && (
              <button
                onClick={handleToggleBookmark}
                aria-label={isLinked ? "remove bookmark" : "save to dashboard"}
                aria-pressed={isLinked}
                className={`w-11 h-11 rounded-full transition-all flex items-center justify-center hover:scale-110 hover:-translate-y-0.5 active:scale-95 ${isLinked ? "text-emerald-600 bg-emerald-100 border border-emerald-200" : "text-stone-400 bg-white border border-stone-100 shadow-sm"}`}
              >
                <svg
                  className="w-5 h-5"
                  fill={isLinked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={handleShare}
              disabled={isSharing}
              aria-label="share trip"
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-stone-100 shadow-sm text-stone-400 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100 disabled:active:scale-100"
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
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                aria-label="trip settings"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-stone-100 shadow-sm text-stone-400 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* trip status pill */}
        <div className="mb-4 z-10 relative">
          <div
            className={`flex items-center w-full px-5 sm:px-6 py-3.5 shadow-sm backdrop-blur-xl border rounded-full transition-colors duration-500 ${trip.status === "finished" ? "bg-emerald-50 border-emerald-200" : daysLeft <= 2 ? "bg-rose-50 border-rose-200" : "bg-white border-stone-200"}`}
          >
            <div className="relative flex items-center justify-center shrink-0 mr-4">
              {trip.status === "settled" ? (
                <span className="relative z-10 text-lg" aria-hidden="true">
                  ✨
                </span>
              ) : daysLeft <= 2 ? (
                <span
                  className="relative z-10 text-lg animate-pulse"
                  aria-hidden="true"
                >
                  ⚠️
                </span>
              ) : (
                <span className="relative z-10 text-lg" aria-hidden="true">
                  ⏳
                </span>
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-center pt-0.5">
              <span
                className={`text-[11px] font-black tracking-widest uppercase leading-none truncate ${trip.status === "finished" ? "text-emerald-800" : daysLeft <= 2 ? "text-rose-800" : "text-stone-800"}`}
              >
                {trip.status === "finished"
                  ? "saved permanently"
                  : `expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
              </span>
              <span
                className={`text-[9px] font-bold mt-1 tracking-wider uppercase truncate ${trip.status === "finished" ? "text-emerald-600" : daysLeft <= 2 ? "text-rose-600" : "text-stone-500"}`}
              >
                {trip.status === "finished"
                  ? "locked & secured"
                  : `last active ${timeAgo(trip.updatedAt || trip.createdAt)}`}
              </span>
            </div>
            <button
              onClick={() => {
                if (trip.status === "finished") {
                  showAlert(
                    "this trip is safely locked and stored permanently in the database. no cleanup robots will touch it! ✨",
                    "trip secured 🔒",
                  );
                } else {
                  showAlert(
                    "mark this trip as 'settled' in the settings menu to save it permanently. otherwise, the database will automatically clean it up to save space!",
                    "retention policy ⏳",
                  );
                }
              }}
              aria-label="retention policy info"
              className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90 ${trip.status === "finished" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : daysLeft <= 2 ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800"}`}
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* hero dashboard */}
        <div className="bg-emerald-700 text-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/15 mb-10 flex flex-col items-center text-center relative overflow-hidden group">
          <div
            className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"
            aria-hidden="true"
          ></div>
          <div
            className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -ml-10 -mb-10 group-hover:translate-x-4 transition-transform duration-700"
            aria-hidden="true"
          ></div>

          <div className="flex flex-wrap justify-center gap-2 mb-4 relative z-10">
            <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border border-white/20">
              {trip.status === "finished"
                ? "🔒 settled trip"
                : "💸 active trip"}
            </div>
            {trip.status !== "finished" && (
              <div
                className={`px-4 py-1.5 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border flex items-center gap-1.5 transition-colors ${trip.is_collaborative ? "bg-emerald-400/30 border-emerald-300/50 text-white shadow-[0_0_10px_rgba(52,211,153,0.2)]" : "bg-black/20 border-white/10 text-stone-200"}`}
              >
                {trip.is_collaborative ? (
                  <>
                    <span
                      className="text-base leading-none pb-0.5"
                      aria-hidden="true"
                    >
                      🤝
                    </span>{" "}
                    open to edit
                  </>
                ) : (
                  <>
                    <span
                      className="text-base leading-none pb-0.5"
                      aria-hidden="true"
                    >
                      👀
                    </span>{" "}
                    view only
                  </>
                )}
              </div>
            )}
          </div>

          <div className="text-[10px] sm:text-xs font-black tracking-widest text-emerald-200/80 uppercase mb-1.5 relative z-10 flex items-center justify-center gap-1.5">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {/* 🔥 U10: locale-aware */}
            {formatDisplayDateTime(trip.createdAt)}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2 relative z-10">
            {trip.name}
          </h1>

          <div className="text-xs font-bold text-emerald-100 mb-2 relative z-10 flex items-center justify-center gap-1.5">
            <span>created by</span>
            <span className="text-white bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-sm shadow-inner">
              {isOwner ? "you" : trip.owner_name || "the host"} 👑
            </span>
          </div>

          <div className="text-5xl font-black tracking-tighter relative z-10 my-2 drop-shadow-md">
            <span className="text-2xl text-emerald-200 align-top mr-1">
              {currencySymbol}
            </span>
            {formatMoney(totalTripCost, currencyCode)}
          </div>

          <div className="flex items-center gap-2 mt-6 bg-black/25 px-5 py-2 rounded-full text-xs font-bold text-emerald-50 backdrop-blur-sm relative z-10 shadow-inner">
            {isSyncing ? (
              <>
                <div
                  className="w-3 h-3 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                ></div>{" "}
                syncing magically ✨
              </>
            ) : (
              <>
                <div
                  className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                  aria-hidden="true"
                ></div>{" "}
                safely saved in cloud
              </>
            )}
          </div>
        </div>

        {/* 🔥 A2: collaborative-mode toggle is now a real switch */}
        {isOwner && trip.status !== "finished" && (
          <div className="bg-white border-2 border-stone-100 rounded-3xl p-5 shadow-sm mb-10 flex items-center justify-between group hover:border-emerald-200 transition-colors animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col">
              <span className="font-black text-stone-800 text-base flex items-center gap-2">
                🌐 collaborative mode
              </span>
              <span className="text-[11px] font-bold text-stone-400 mt-1 uppercase tracking-wider">
                {trip.is_collaborative
                  ? "anyone with the link can add expenses"
                  : "only you can add expenses"}
              </span>
            </div>
            <label className="cursor-pointer shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={trip.is_collaborative ?? false}
                aria-checked={trip.is_collaborative ?? false}
                aria-label="collaborative mode"
                onChange={() =>
                  toggleCollaborative(trip.id, !trip.is_collaborative)
                }
                className="sr-only peer"
              />
              <div
                className={`relative w-14 h-8 rounded-full transition-colors duration-300 ease-in-out shadow-inner peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-100 ${trip.is_collaborative ? "bg-emerald-500" : "bg-stone-200"}`}
                aria-hidden="true"
              >
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${trip.is_collaborative ? "translate-x-6" : "translate-x-0"}`}
                />
              </div>
            </label>
          </div>
        )}

        {/* crew section */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-stone-800">
                members 🤘
              </h2>
              <button
                onClick={() =>
                  showAlert(
                    "just type their names! anyone you add here is just a local profile for this trip.",
                    "how members work 👥",
                  )
                }
                aria-label="how members work"
                className="w-6 h-6 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
            {canEdit && trip.status !== "finished" && (
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="group flex items-center gap-2.5 text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-stone-200 text-stone-600 rounded-xl hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all active:scale-95 shadow-sm"
              >
                {trip.members.length === 0 ? (
                  <span>add member(s)</span>
                ) : (
                  <>
                    <span className="flex items-center justify-center bg-stone-100 text-stone-500 min-w-5.5 h-5.5 px-1.5 rounded-lg group-hover:bg-stone-700 group-hover:text-stone-300 transition-colors">
                      {trip.members.length}
                    </span>
                    <span>edit member(s)</span>
                  </>
                )}
              </button>
            )}
          </div>
          {trip.members.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-stone-200 rounded-3xl text-center bg-white/50">
              <p className="text-sm font-bold text-stone-400">
                no members yet! add some friends to start splitting.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {trip.members.map((member) => (
                <div
                  key={member.id}
                  className="pl-1.5 pr-4 py-1.5 bg-white border-2 border-stone-100 shadow-sm rounded-full text-sm font-bold flex items-center gap-2 hover:-translate-y-1 hover:shadow-md hover:border-emerald-200 transition-all cursor-default group"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border transition-transform group-hover:scale-110 group-hover:rotate-6 ${getAvatarColor(member.name)}`}
                    aria-hidden="true"
                  >
                    {getInitials(member.name)}
                  </div>
                  <span className="text-stone-700">{member.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* expenses section */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <div className="flex justify-between items-end mb-4 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-stone-800">
                expenses/bills 🧾
              </h2>
              <button
                onClick={() =>
                  showAlert(
                    "add your group receipts here! inside, you can choose to split the bill equally, type in exact amounts, or scan the receipt and assign individual items.",
                    "how expenses work 💸",
                  )
                }
                aria-label="how expenses work"
                className="w-6 h-6 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {trip.expenses.length > 0 && (
            <div className="flex gap-2 mb-5">
              <CustomSelect
                value={filterCategory}
                onChange={(val) => setFilterCategory(val)}
                options={[
                  { value: "all", label: "all categories" },
                  ...usedCategories.map((c) => ({ value: c, label: c })),
                ]}
                className="flex-1 min-w-0"
              />
              <CustomSelect
                value={sortBy}
                onChange={(val) =>
                  setSortBy(
                    val as "newest" | "oldest" | "amount_high" | "amount_low",
                  )
                }
                options={[
                  { value: "newest", label: "latest first" },
                  { value: "oldest", label: "oldest first" },
                  { value: "amount_high", label: "highest $$" },
                  { value: "amount_low", label: "lowest $$" },
                ]}
                className="flex-1 min-w-0"
              />
            </div>
          )}

          <div className="space-y-4">
            {processedExpenses.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200">
                <div
                  className="text-5xl mb-4 animate-bounce inline-block"
                  aria-hidden="true"
                >
                  🍔
                </div>
                <h3 className="text-lg font-extrabold text-stone-800 mb-1">
                  tab is empty!
                </h3>
                <span className="text-sm font-bold text-stone-400">
                  add the first expense to get started.
                </span>
              </div>
            ) : (
              processedExpenses.map((exp) => {
                const payersEntries = Object.entries(exp.paidBy);
                const isMultiPayer = payersEntries.length > 1;
                const singlePayerName = !isMultiPayer
                  ? getMemberName(payersEntries[0][0])
                  : "";
                const isExpanded = expandedExpenseId === exp.id;
                const itemsSum =
                  exp.splitType === "exact" && exp.items
                    ? exp.items.reduce((acc, item) => acc + item.price, 0)
                    : 0;
                const difference = exp.totalAmount - itemsSum;

                return (
                  <div
                    key={exp.id}
                    className="bg-white rounded-3xl shadow-sm border-2 border-stone-100 overflow-hidden group hover:border-emerald-200 hover:shadow-md transition-all duration-300"
                  >
                    <button
                      onClick={() =>
                        setExpandedExpenseId(isExpanded ? null : exp.id)
                      }
                      aria-expanded={isExpanded}
                      className="w-full flex justify-between items-start p-4 sm:p-5 text-left active:bg-stone-50 transition-colors gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        {/* date */}
                        <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-1 block">
                          {formatDisplayDateTime(exp.expenseDate)}
                        </span>
                        {/* title */}
                        <p className="text-base sm:text-lg font-extrabold text-stone-800 truncate mb-2">
                          {exp.title}
                        </p>
                        {/* metadata pills */}
                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-1.5">
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-stone-100 text-stone-500 rounded-md text-[9px] sm:text-[10px] tracking-widest uppercase shrink-0 font-bold">
                            {exp.category || "other"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[9px] sm:text-[10px] tracking-widest uppercase shrink-0 border font-bold ${exp.splitType === "exact" ? "border-indigo-100 text-indigo-500 bg-indigo-50" : exp.splitType === "equal" ? "border-emerald-100 text-emerald-500 bg-emerald-50" : "border-amber-100 text-amber-500 bg-amber-50"}`}
                          >
                            {exp.splitType === "exact"
                              ? "by item"
                              : exp.splitType === "equal"
                                ? "equally"
                                : "custom"}
                          </span>
                        </div>
                        {/* 🔥 finding #2 + #3: paid-by gets its own row, never truncated */}
                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-stone-500">
                          {isMultiPayer ? (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayerBreakdownExpense(exp);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPayerBreakdownExpense(exp);
                                }
                              }}
                              aria-label={`view breakdown for ${payersEntries.length} payers`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 hover:bg-stone-200 rounded-md text-[10px] font-black tracking-widest uppercase transition-colors active:scale-95"
                            >
                              👥 {payersEntries.length} payers
                              <span
                                className="text-stone-400"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </span>
                          ) : (
                            <span className="truncate">
                              paid by{" "}
                              <span className="text-stone-700">
                                {singlePayerName}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-lg sm:text-xl font-black text-emerald-600">
                          {/* 🔥 U10/U14 */}
                          {currencySymbol}
                          {formatMoney(exp.totalAmount, currencyCode)}
                        </p>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 mt-1 flex items-center justify-end gap-1">
                          {isExpanded ? "close" : "details"}
                          <span
                            className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center bg-stone-100 rounded-full transition-transform duration-300 ${isExpanded ? "rotate-180 bg-emerald-100 text-emerald-600" : ""}`}
                            aria-hidden="true"
                          >
                            <svg
                              className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </span>
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-5 border-t-2 border-stone-100 bg-stone-50/50 animate-in slide-in-from-top-2 duration-200">
                        {exp.splitType === "exact" &&
                          exp.items &&
                          exp.items.length > 0 && (
                            <div className="mb-6 space-y-3">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">
                                receipt items
                              </span>
                              <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 border border-stone-100 shadow-sm">
                                {exp.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex justify-between items-center text-sm"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-bold text-stone-700">
                                        {item.name}
                                      </span>
                                      <span className="text-[10px] sm:text-xs font-bold text-stone-400 mt-0.5">
                                        {item.assignedTo
                                          .map((id) => getMemberName(id))
                                          .join(", ")}
                                      </span>
                                    </div>
                                    <span className="font-black text-stone-600">
                                      {currencySymbol}
                                      {formatMoney(item.price, currencyCode)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {Math.abs(difference) > 0 && (
                                <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl text-xs sm:text-sm font-bold text-amber-800 flex items-start gap-3 shadow-sm">
                                  <span
                                    className="text-xl leading-none"
                                    aria-hidden="true"
                                  >
                                    💡
                                  </span>
                                  <p className="leading-tight">
                                    subtotal is{" "}
                                    <span className="font-black">
                                      {currencySymbol}
                                      {formatMoney(itemsSum, currencyCode)}
                                    </span>
                                    . the extra{" "}
                                    <span className="font-black">
                                      {currencySymbol}
                                      {formatMoney(
                                        Math.abs(difference),
                                        currencyCode,
                                      )}
                                    </span>{" "}
                                    {difference > 0 ? "tax/tip" : "discount"} is
                                    split fairly across the items.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        <div className="space-y-3 mb-6">
                          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">
                            who owes what
                          </span>
                          {Object.entries(exp.owedBy).map(
                            ([memberId, amount]) => {
                              const isPayer = payersEntries.some(
                                ([id]) => id === memberId,
                              );
                              const canMarkPaid =
                                !isPayer &&
                                canEdit &&
                                !isMultiPayer &&
                                trip.status !== "finished";
                              const isSettled =
                                exp.settledShares?.[memberId] || false;
                              const extra = exp.adjustments?.[memberId];

                              const memberBaseSum =
                                exp.splitType === "exact" && exp.items
                                  ? exp.items
                                      .filter((i) =>
                                        i.assignedTo.includes(memberId),
                                      )
                                      .reduce((acc, i) => {
                                        const userShares = i.assignedTo.filter(
                                          (id) => id === memberId,
                                        ).length;
                                        return (
                                          acc +
                                          (i.price / i.assignedTo.length) *
                                            userShares
                                        );
                                      }, 0)
                                  : 0;
                              const memberDiffShare =
                                amount - memberBaseSum - (extra || 0);

                              return (
                                <div
                                  key={memberId}
                                  className="flex flex-col bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black border ${getAvatarColor(getMemberName(memberId))}`}
                                        aria-hidden="true"
                                      >
                                        {getInitials(getMemberName(memberId))}
                                      </div>
                                      <span
                                        className={`text-sm sm:text-base font-extrabold truncate ${isSettled ? "text-stone-400" : "text-stone-800"}`}
                                      >
                                        {getMemberName(memberId)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 pl-2">
                                      {canMarkPaid ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleExpenseSettled(
                                              tripId,
                                              exp.id,
                                              memberId,
                                            );
                                          }}
                                          aria-label={
                                            isSettled
                                              ? `mark ${getMemberName(memberId)} unpaid`
                                              : `mark ${getMemberName(memberId)} paid`
                                          }
                                          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${isSettled ? "bg-emerald-50 text-emerald-600 hover:bg-rose-50 hover:text-rose-600" : "bg-stone-100 text-stone-600 hover:bg-emerald-100 hover:text-emerald-700"}`}
                                        >
                                          {isSettled ? "paid ✓" : "mark paid"}
                                        </button>
                                      ) : (
                                        isSettled && (
                                          <span className="text-[11px] font-bold px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                            paid ✓
                                          </span>
                                        )
                                      )}
                                      <div className="flex flex-col items-end min-w-17.5 sm:min-w-21.25">
                                        <span
                                          className={`font-black text-lg leading-none ${isSettled ? "text-stone-300 line-through decoration-2" : "text-stone-800"}`}
                                        >
                                          {currencySymbol}
                                          {formatMoney(amount, currencyCode)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {((exp.splitType === "exact" && exp.items) ||
                                    extra) && (
                                    <div className="pl-11 w-full flex flex-col gap-1 mt-2">
                                      {exp.splitType === "exact" &&
                                        exp.items && (
                                          <>
                                            {exp.items
                                              .filter((i) =>
                                                i.assignedTo.includes(memberId),
                                              )
                                              .map((i) => {
                                                const userShares =
                                                  i.assignedTo.filter(
                                                    (id) => id === memberId,
                                                  ).length;
                                                const totalShares =
                                                  i.assignedTo.length;
                                                const myBaseShare =
                                                  (i.price / totalShares) *
                                                  userShares;
                                                const shareText =
                                                  totalShares > 1
                                                    ? ` (${userShares}/${totalShares})`
                                                    : "";
                                                return (
                                                  <span
                                                    key={i.id}
                                                    className="text-[11px] font-bold text-stone-400 leading-tight flex justify-between gap-3"
                                                  >
                                                    <span className="truncate">
                                                      ↳ {i.name}
                                                      {shareText}
                                                    </span>
                                                    <span className="shrink-0 text-stone-300">
                                                      {currencySymbol}
                                                      {formatMoney(
                                                        myBaseShare,
                                                        currencyCode,
                                                      )}
                                                    </span>
                                                  </span>
                                                );
                                              })}
                                            {Math.abs(difference) > 0 &&
                                              Math.abs(memberDiffShare) >=
                                                0.5 && (
                                                <span
                                                  className={`text-[11px] font-bold leading-tight flex justify-between gap-3 ${difference > 0 ? "text-amber-500/80" : "text-emerald-500/80"}`}
                                                >
                                                  <span className="truncate">
                                                    ↳{" "}
                                                    {difference > 0
                                                      ? "tax & tip"
                                                      : "global discount"}
                                                  </span>
                                                  <span className="shrink-0">
                                                    {memberDiffShare > 0
                                                      ? "+"
                                                      : "-"}
                                                    {currencySymbol}
                                                    {formatMoney(
                                                      Math.abs(memberDiffShare),
                                                      currencyCode,
                                                    )}
                                                  </span>
                                                </span>
                                              )}
                                          </>
                                        )}
                                      {extra ? (
                                        exp.splitType === "adjustment" ? (
                                          <>
                                            <span className="text-[11px] font-bold text-stone-400 leading-tight flex justify-between gap-3 mt-1">
                                              <span className="truncate">
                                                ↳ debt after split
                                              </span>
                                              <span className="shrink-0 text-stone-300">
                                                {currencySymbol}
                                                {formatMoney(
                                                  amount - extra,
                                                  currencyCode,
                                                )}
                                              </span>
                                            </span>
                                            <span className="text-[11px] font-bold text-amber-500/80 leading-tight flex justify-between gap-3">
                                              <span className="truncate">
                                                <span className="text-amber-400/50 mr-1.5">
                                                  ↳
                                                </span>
                                                adjusted bill
                                              </span>
                                              <span className="shrink-0 text-amber-500">
                                                +{currencySymbol}
                                                {formatMoney(
                                                  extra,
                                                  currencyCode,
                                                )}
                                              </span>
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-[11px] font-bold text-amber-500/80 leading-tight flex justify-between gap-3 mt-1">
                                            <span className="truncate">
                                              <span className="text-amber-400/50 mr-1.5">
                                                ↳
                                              </span>
                                              extra adjustment
                                            </span>
                                            <span className="shrink-0 text-amber-500">
                                              +{currencySymbol}
                                              {formatMoney(extra, currencyCode)}
                                            </span>
                                          </span>
                                        )
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                        <div className="flex gap-2 sm:gap-3">
                          {canEdit && trip.status !== "finished" ? (
                            <>
                              <button
                                onClick={() =>
                                  router.push(`/expense/${exp.id}`)
                                }
                                aria-label="share expense"
                                className="w-12 sm:w-14 shrink-0 flex items-center justify-center bg-white border-2 border-stone-200 text-stone-500 hover:border-emerald-400 hover:text-emerald-500 rounded-2xl transition-all active:scale-95 shadow-sm"
                              >
                                <svg
                                  className="w-5 h-5 sm:w-6 sm:h-6"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingExpense(exp);
                                  setExpandedExpenseId(null);
                                  setIsAddingExpense(true);
                                }}
                                className="flex-1 text-xs sm:text-sm font-bold py-3 sm:py-3.5 bg-white border-2 border-stone-200 text-stone-700 hover:border-stone-800 hover:bg-stone-800 hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm"
                              >
                                ✏️ edit
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="flex-1 text-xs sm:text-sm font-bold py-3 sm:py-3.5 bg-white border-2 border-rose-100 text-rose-500 hover:border-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm"
                              >
                                🗑️ delete
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => router.push(`/expense/${exp.id}`)}
                              className="flex-1 text-sm font-black py-3 sm:py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
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
                                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                />
                              </svg>
                              share
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ledger */}
        {trip.expenses.length > 0 && (
          <section className="mt-14 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <div className="flex justify-between items-end mb-4 px-1">
              <div className="flex items-center justify-between w-full">
                <h2 className="text-xl font-extrabold text-stone-800">
                  who pays who 🤝
                </h2>
                <button
                  onClick={() => setShowSettlementModal(true)}
                  className="text-xs font-bold px-4 py-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 hover:text-stone-800 transition-colors flex items-center gap-2 shadow-sm active:scale-95"
                >
                  verify my tab 🧾
                </button>
              </div>
            </div>

            {/* who pays who */}
            {settlements.length === 0 ? (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 text-center transform hover:rotate-1 transition-transform">
                <div className="text-4xl mb-2" aria-hidden="true">
                  ⚖️
                </div>
                <span className="text-emerald-800 font-extrabold text-base">
                  everything is perfectly balanced!
                </span>
                <p className="text-emerald-600 font-bold text-xs mt-1">
                  no one owes anyone a dime.
                </p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div
                  className="absolute left-6 top-6 bottom-6 w-1 bg-stone-200 rounded-full z-0"
                  aria-hidden="true"
                ></div>
                {settlements.map((settlement, index) => (
                  <div key={index} className="relative z-10 flex flex-col">
                    <div className="flex justify-between items-center p-4 sm:p-5 bg-stone-900 text-white rounded-4xl shadow-xl shadow-stone-900/10 hover:-translate-y-1 transition-all text-left w-full gap-2 relative z-20 group">
                      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.from.name)}`}
                          aria-hidden="true"
                        >
                          {getInitials(settlement.from.name)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-extrabold text-base sm:text-lg truncate">
                            {settlement.from.name}
                          </span>
                          <span className="text-stone-400 font-bold text-[9px] sm:text-xs tracking-widest uppercase">
                            pays
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 text-right flex-1 min-w-0 justify-end">
                        <div className="flex flex-col min-w-0 items-end">
                          <span className="font-extrabold text-base sm:text-lg text-emerald-400 truncate max-w-full">
                            {currencySymbol}
                            {formatMoney(settlement.amount, currencyCode)}
                          </span>
                          <span className="text-stone-400 font-bold text-[9px] sm:text-xs tracking-widest uppercase truncate max-w-full">
                            to {settlement.to.name}
                          </span>
                        </div>
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.to.name)}`}
                          aria-hidden="true"
                        >
                          {getInitials(settlement.to.name)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={() => setShowLedger(!showLedger)}
                aria-expanded={showLedger}
                className="w-full py-4 bg-white border-2 border-stone-200 rounded-2xl text-sm font-extrabold text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98]"
              >
                {showLedger ? "hide ledger details ↑" : "show ledger details ↓"}
              </button>

              {showLedger && (
                <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {trip.members.map((member) => {
                    const details = memberDetails[member.id];
                    if (
                      !details ||
                      (details.totalPaid === 0 && details.totalOwed === 0)
                    )
                      return null;

                    const net = details.totalPaid - details.totalOwed;
                    const isExpanded = expandedLedgerMemberId === member.id;
                    const showSettled = settledRevealed.has(member.id);

                    const activeOwedItems = details.owedItems.filter(
                      (i) => !i.isSettled,
                    );
                    const settledOwedItems = details.owedItems.filter(
                      (i) => i.isSettled,
                    );

                    return (
                      <div
                        key={member.id}
                        className="bg-white border-2 border-stone-100 rounded-2xl overflow-hidden hover:border-stone-200 transition-colors"
                      >
                        {/* compact header — always visible */}
                        <button
                          onClick={() =>
                            setExpandedLedgerMemberId(
                              isExpanded ? null : member.id,
                            )
                          }
                          aria-expanded={isExpanded}
                          className="w-full flex items-center justify-between p-4 text-left active:bg-stone-50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-black border ${getAvatarColor(member.name)}`}
                              aria-hidden="true"
                            >
                              {getInitials(member.name)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-extrabold text-stone-800 truncate text-base">
                                {member.name}
                              </span>
                              <span className="text-[11px] font-medium text-stone-400 truncate">
                                paid {currencySymbol}
                                {formatMoney(details.totalPaid, currencyCode)} ·
                                consumed {currencySymbol}
                                {formatMoney(details.totalOwed, currencyCode)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[11px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border ${
                                net > 0
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : net < 0
                                    ? "bg-rose-50 text-rose-600 border-rose-100"
                                    : "bg-stone-50 text-stone-400 border-stone-100"
                              }`}
                            >
                              {net > 0 ? "+" : net < 0 ? "−" : ""}
                              {currencySymbol}
                              {formatMoney(Math.abs(net), currencyCode)}
                            </span>
                            <span
                              className={`w-6 h-6 flex items-center justify-center rounded-full transition-transform duration-300 ${isExpanded ? "rotate-180 bg-stone-100 text-stone-600" : "text-stone-400"}`}
                              aria-hidden="true"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={3}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </span>
                          </div>
                        </button>

                        {/* expanded body */}
                        {isExpanded && (
                          <div className="border-t border-stone-100 bg-stone-50/40 px-3 py-5 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* PAID UPFRONT */}
                            {details.paidItems.length > 0 && (
                              <div>
                                <div className="flex items-baseline justify-between mb-2.5 px-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                                      💳 paid upfront
                                    </span>
                                    <span className="text-[10px] font-black text-stone-300 tabular-nums">
                                      {details.paidItems.length}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-black text-emerald-700 tabular-nums">
                                    {currencySymbol}
                                    {formatMoney(
                                      details.totalPaid,
                                      currencyCode,
                                    )}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {details.paidItems.map((item, idx) => (
                                    <div
                                      key={`paid-${idx}`}
                                      className={`bg-white border border-stone-200/70 rounded-xl px-3.5 py-3 ${item.isNegative ? "border-dashed" : ""}`}
                                    >
                                      <div className="flex items-start justify-between gap-3 mb-1">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          {item.expenseDate && (
                                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">
                                              {formatDisplayDateTime(
                                                item.expenseDate,
                                              )}
                                            </span>
                                          )}
                                          <span
                                            className={`text-sm leading-tight truncate ${item.isNegative ? "text-stone-500 italic font-semibold" : "text-stone-800 font-black"}`}
                                          >
                                            {item.title}
                                          </span>
                                        </div>
                                        <span
                                          className={`font-black shrink-0 tabular-nums text-sm ${item.isNegative ? "text-rose-500" : "text-emerald-700"}`}
                                        >
                                          {item.isNegative ? "−" : "+"}
                                          {currencySymbol}
                                          {formatMoney(
                                            Math.abs(item.amount),
                                            currencyCode,
                                          )}
                                        </span>
                                      </div>
                                      {!item.isNegative &&
                                        item.totalExpense && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 mt-1 flex-wrap">
                                            <span>
                                              your share of{" "}
                                              <span className="text-stone-600 tabular-nums">
                                                {currencySymbol}
                                                {formatMoney(
                                                  item.totalExpense,
                                                  currencyCode,
                                                )}
                                              </span>
                                            </span>
                                            {item.totalExpense > 0 && (
                                              <>
                                                <span aria-hidden="true">
                                                  ·
                                                </span>
                                                <span className="tabular-nums">
                                                  {Math.round(
                                                    (item.amount /
                                                      item.totalExpense) *
                                                      100,
                                                  )}
                                                  %
                                                </span>
                                              </>
                                            )}
                                            {item.payerCount &&
                                              item.payerCount > 1 && (
                                                <>
                                                  <span aria-hidden="true">
                                                    ·
                                                  </span>
                                                  <span>
                                                    split with{" "}
                                                    {item.payerCount - 1} other
                                                  </span>
                                                </>
                                              )}
                                          </div>
                                        )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* CONSUMED — receipt cards */}
                            {activeOwedItems.length > 0 && (
                              <div>
                                <div className="flex items-baseline justify-between mb-2.5 px-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[10px] font-black text-stone-700 uppercase tracking-widest">
                                      🍕 consumed
                                    </span>
                                    <span className="text-[10px] font-black text-stone-300 tabular-nums">
                                      {activeOwedItems.length}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-black text-stone-700 tabular-nums">
                                    {currencySymbol}
                                    {formatMoney(
                                      details.totalOwed,
                                      currencyCode,
                                    )}
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {activeOwedItems.map((item, idx) => {
                                    const itemRows = item.itemRows || [];
                                    const callouts = item.callouts || [];
                                    const hasItems = itemRows.length > 0;
                                    const hasCallouts = callouts.length > 0;
                                    const subtotal =
                                      item.baseAmount ??
                                      itemRows.reduce((s, r) => s + r.price, 0);

                                    return (
                                      <div
                                        key={`owed-${idx}`}
                                        className="bg-white border border-stone-200/70 rounded-xl overflow-hidden"
                                      >
                                        {/* receipt header */}
                                        <div className="px-3.5 pt-3 pb-2.5 bg-gradient-to-b from-stone-50 to-transparent border-b border-dashed border-stone-200">
                                          {item.expenseDate && (
                                            <div className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">
                                              {formatDisplayDateTime(
                                                item.expenseDate,
                                              )}
                                            </div>
                                          )}
                                          <div className="flex justify-between items-baseline gap-3 mb-1.5">
                                            <span className="text-sm font-black text-stone-800 truncate">
                                              {item.title}
                                            </span>
                                            {item.totalExpense && (
                                              <span className="text-[10px] font-bold text-stone-400 shrink-0 tabular-nums">
                                                bill {currencySymbol}
                                                {formatMoney(
                                                  item.totalExpense,
                                                  currencyCode,
                                                )}
                                              </span>
                                            )}
                                          </div>
                                          {item.paidByList &&
                                            item.paidByList.length > 0 && (
                                              <div className="text-[10px] font-bold text-stone-500 flex items-center gap-1 flex-wrap">
                                                <span className="text-stone-400">
                                                  paid by
                                                </span>
                                                {item.paidByList.map((p, i) => (
                                                  <span
                                                    key={i}
                                                    className="flex items-center gap-1"
                                                  >
                                                    <span className="text-stone-700 font-black">
                                                      {p.name}
                                                    </span>
                                                    {item.paidByList!.length >
                                                      1 && (
                                                      <span className="text-stone-400 tabular-nums">
                                                        ({currencySymbol}
                                                        {formatMoney(
                                                          p.amount,
                                                          currencyCode,
                                                        )}
                                                        )
                                                      </span>
                                                    )}
                                                    {i <
                                                      item.paidByList!.length -
                                                        1 && (
                                                      <span className="text-stone-300">
                                                        +
                                                      </span>
                                                    )}
                                                  </span>
                                                ))}
                                                {item.memberCount && (
                                                  <>
                                                    <span
                                                      className="text-stone-300"
                                                      aria-hidden="true"
                                                    >
                                                      ·
                                                    </span>
                                                    <span className="text-stone-400">
                                                      split {item.memberCount}{" "}
                                                      ways
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                        </div>

                                        {/* receipt body */}
                                        <div className="px-3.5 py-2.5">
                                          {hasItems && (
                                            <div className="space-y-1 mb-2">
                                              {itemRows.map((row, rIdx) => (
                                                <div
                                                  key={`row-${rIdx}`}
                                                  className="flex items-center justify-between gap-2 text-xs"
                                                >
                                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <span className="text-stone-700 font-bold truncate">
                                                      {row.name}
                                                    </span>
                                                    {row.share && (
                                                      <span className="text-[9px] font-black text-stone-500 bg-stone-100 border border-stone-200/60 px-1.5 py-0.5 rounded-md shrink-0 tabular-nums leading-none">
                                                        {row.share}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span className="text-stone-700 font-bold shrink-0 tabular-nums">
                                                    {currencySymbol}
                                                    {formatMoney(
                                                      row.price,
                                                      currencyCode,
                                                    )}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* subtotal line — only if both items and callouts exist */}
                                          {hasItems && hasCallouts && (
                                            <div className="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-stone-200 text-[11px] font-black text-stone-500 uppercase tracking-wider">
                                              <span>subtotal</span>
                                              <span className="tabular-nums">
                                                {currencySymbol}
                                                {formatMoney(
                                                  subtotal,
                                                  currencyCode,
                                                )}
                                              </span>
                                            </div>
                                          )}

                                          {/* callouts (tax/tip/discount/adjustment) */}
                                          {hasCallouts && (
                                            <div className="space-y-1 mt-1.5">
                                              {callouts.map((c, cIdx) => {
                                                const isPositive = c.amount > 0;
                                                const palette =
                                                  c.kind === "discount"
                                                    ? "text-emerald-600"
                                                    : c.kind === "tax"
                                                      ? "text-amber-600"
                                                      : "text-stone-600";
                                                return (
                                                  <div
                                                    key={`callout-${cIdx}`}
                                                    className={`flex justify-between items-center text-[11px] font-bold ${palette}`}
                                                  >
                                                    <span className="flex items-center gap-1.5">
                                                      <span aria-hidden="true">
                                                        +
                                                      </span>
                                                      <span>{c.label}</span>
                                                    </span>
                                                    <span className="font-black tabular-nums">
                                                      {isPositive ? "+" : "−"}
                                                      {currencySymbol}
                                                      {formatMoney(
                                                        Math.abs(c.amount),
                                                        currencyCode,
                                                      )}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {/* total line */}
                                          <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t-2 border-double border-stone-300">
                                            <span className="text-[11px] font-black text-stone-700 uppercase tracking-widest">
                                              your total
                                            </span>
                                            <span className="text-sm font-black text-stone-900 tabular-nums">
                                              {currencySymbol}
                                              {formatMoney(
                                                item.amount,
                                                currencyCode,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* settled — collapsed by default */}
                            {settledOwedItems.length > 0 && (
                              <div>
                                {!showSettled ? (
                                  <button
                                    onClick={() =>
                                      setSettledRevealed((prev) => {
                                        const next = new Set(prev);
                                        next.add(member.id);
                                        return next;
                                      })
                                    }
                                    className="w-full flex items-center justify-between gap-2 text-[10px] font-black text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors py-2.5 px-3 rounded-xl uppercase tracking-widest border border-dashed border-stone-200"
                                  >
                                    <span className="flex items-center gap-2">
                                      <span aria-hidden="true">✓</span>
                                      {settledOwedItems.length} settled item
                                      {settledOwedItems.length !== 1 ? "s" : ""}
                                    </span>
                                    <span aria-hidden="true">show →</span>
                                  </button>
                                ) : (
                                  <div>
                                    <div className="flex justify-between items-baseline mb-2.5 px-1">
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                          ✓ settled
                                        </span>
                                        <span className="text-[10px] font-black text-stone-300 tabular-nums">
                                          {settledOwedItems.length}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() =>
                                          setSettledRevealed((prev) => {
                                            const next = new Set(prev);
                                            next.delete(member.id);
                                            return next;
                                          })
                                        }
                                        className="text-[10px] font-black text-stone-400 hover:text-stone-700 uppercase tracking-widest transition-colors"
                                      >
                                        hide
                                      </button>
                                    </div>
                                    <div className="space-y-1.5 opacity-60">
                                      {settledOwedItems.map((item, idx) => (
                                        <div
                                          key={`settled-${idx}`}
                                          className="bg-white border border-stone-200/70 rounded-xl px-3.5 py-2.5 flex justify-between items-center gap-3"
                                        >
                                          <div className="flex flex-col min-w-0 flex-1">
                                            {item.expenseDate && (
                                              <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-0.5">
                                                {formatDisplayDateTime(
                                                  item.expenseDate,
                                                )}
                                              </span>
                                            )}
                                            <span className="text-sm leading-tight truncate text-stone-600 font-bold line-through decoration-stone-400">
                                              {item.title}
                                            </span>
                                          </div>
                                          <span className="font-black shrink-0 text-stone-500 line-through tabular-nums text-sm">
                                            {currencySymbol}
                                            {formatMoney(
                                              item.amount,
                                              currencyCode,
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
      />

      {/* 🔥 U15: subtle FAB stack — scan and manual now share visual weight */}
      {!isAddingExpense && canEdit && trip.status !== "finished" && (
        <div className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 flex flex-col gap-3 z-40 items-end animate-in slide-in-from-bottom-8 duration-500">
          <button
            onClick={() => {
              if (trip.members.length === 0) {
                showAlert(
                  "you need to add some friends to the tab first!",
                  "lonely trip? 🧍",
                );
              } else {
                setShowScanner(true);
              }
            }}
            disabled={scanStage !== "idle"}
            aria-label="scan receipt"
            className="flex items-center gap-2 pl-5 pr-2 py-2 bg-white border-2 border-stone-200 text-stone-700 rounded-full shadow-sm hover:border-emerald-300 hover:text-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            <span className="text-[11px] font-black tracking-widest uppercase">
              scan
            </span>
            <div
              className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-500"
              aria-hidden="true"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </button>
          <button
            onClick={() => {
              if (trip.members.length === 0) {
                showAlert(
                  "you need to add some friends to the tab first!",
                  "lonely trip? 🧍",
                );
              } else {
                setIsAddingExpense(true);
              }
            }}
            aria-label="add expense"
            className="flex items-center gap-3 pl-6 pr-2 py-2 bg-stone-900 text-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:bg-emerald-600 active:scale-95 transition-all duration-300 group"
          >
            <span className="text-xs font-black tracking-widest uppercase">
              manual
            </span>
            <div
              className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors shadow-inner"
              aria-hidden="true"
            >
              <svg
                className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* 🔥 U12: honest stage-based scanning overlay (no Math.random) */}
      <ScanningOverlay stage={scanStage} />

      {/* 🔥 finding #3: payer breakdown sheet */}
      {payerBreakdownExpense && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payer-breakdown-title"
          onClick={() => setPayerBreakdownExpense(null)}
        >
          <div
            className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"
              aria-hidden="true"
            ></div>
            <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
              <h2
                id="payer-breakdown-title"
                className="text-xl font-black text-stone-800 flex items-center gap-2"
              >
                <span aria-hidden="true">👥</span>
                payers
              </h2>
              <button
                onClick={() => setPayerBreakdownExpense(null)}
                aria-label="close"
                className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-stone-500 mb-4 truncate">
                {payerBreakdownExpense.title}
              </p>
              <div className="space-y-2">
                {Object.entries(payerBreakdownExpense.paidBy).map(
                  ([id, amt]) => {
                    const name = getMemberName(id);
                    const pct =
                      payerBreakdownExpense.totalAmount > 0
                        ? Math.round(
                            (amt / payerBreakdownExpense.totalAmount) * 100,
                          )
                        : 0;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between p-3 bg-white border-2 border-stone-100 rounded-2xl"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black border ${getAvatarColor(name)}`}
                            aria-hidden="true"
                          >
                            {getInitials(name)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-stone-800 truncate">
                              {name}
                            </span>
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                              {pct}% of total
                            </span>
                          </div>
                        </div>
                        <span className="font-black text-emerald-600 shrink-0">
                          {currencySymbol}
                          {formatMoney(amt, currencyCode)}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
              <div className="mt-4 pt-4 border-t-2 border-stone-100 flex justify-between items-center">
                <span className="text-xs font-black text-stone-400 uppercase tracking-widest">
                  total
                </span>
                <span className="font-black text-stone-800 text-lg">
                  {currencySymbol}
                  {formatMoney(payerBreakdownExpense.totalAmount, currencyCode)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddingExpense && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[#fdfbf7] w-full max-w-md h-[92vh] sm:h-auto sm:max-h-[92vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative">
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"
              aria-hidden="true"
            ></div>
            <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
              <h2 className="text-2xl font-black text-stone-800">
                {editingExpense ? "edit expense ✏️" : "new expense 💸"}
              </h2>
              <button
                onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpense(undefined);
                }}
                aria-label="close"
                className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pb-12">
              <ExpenseForm
                members={trip.members}
                initialExpense={editingExpense}
                onSave={handleSaveExpense}
                onCancel={() => {
                  setIsAddingExpense(false);
                  setEditingExpense(undefined);
                }}
                currencySymbol={currencySymbol}
                currencyCode={currencyCode}
              />
            </div>
          </div>
        </div>
      )}

      <TripSettingsModal
        key={showSettings ? "open" : "closed"}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        trip={trip}
      />
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        trip={trip}
      />
      <SettlementModal
        isOpen={showSettlementModal}
        onClose={() => setShowSettlementModal(false)}
        members={trip.members}
        memberDetails={memberDetails}
        settlements={settlements}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
      />

      {showScanner && (
        <CameraScanner
          onClose={() => setShowScanner(false)}
          onUploadFallback={() => {
            setShowScanner(false);
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 100);
          }}
          onCapture={(file) => {
            setShowScanner(false);
            processReceiptFile(file);
          }}
        />
      )}

      {/* off-screen trip snapshot for exporting */}
      {trip && (
        <div className="overflow-hidden absolute -left-2499.75 top-0 pointer-events-none">
          <div
            ref={shareCardRef}
            className="w-112.5 bg-emerald-50 p-10 flex flex-col relative font-sans"
          >
            {/* decorative background blobs */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-200/40 rounded-bl-full mix-blend-multiply"></div>
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-emerald-200/40 rounded-tr-full mix-blend-multiply"></div>

            <div className="bg-white border-2 border-emerald-100 rounded-[2.5rem] p-8 shadow-xl relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Emoji char="🎒" className="h-8! w-8!" />
              </div>

              <h1 className="text-3xl font-black text-stone-800 leading-tight mb-2">
                {trip.name}
              </h1>

              <span className="font-bold text-stone-400 text-[10px] uppercase tracking-widest mb-8 border-b-2 border-stone-100 pb-2 px-4">
                trip snapshot
              </span>

              <div className="w-full bg-[#fdfbf7] rounded-3xl p-6 mb-8 border-2 border-stone-100 shadow-inner">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                  total group spend
                </span>
                <span className="text-5xl font-black text-emerald-500 flex items-start justify-center">
                  <span className="text-2xl mt-1.5 mr-1">{currencySymbol}</span>
                  {formatMoney(totalTripCost, currencyCode)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-3 mb-8 w-full">
                <span className="text-[9px] font-black text-stone-300 uppercase tracking-widest">
                  the crew
                </span>
                <div className="flex gap-2 flex-wrap justify-center">
                  {trip.members.slice(0, 6).map((m) => (
                    <span
                      key={m.id}
                      className="text-[11px] font-extrabold bg-stone-100 border border-stone-200/60 text-stone-500 px-3 py-1.5 rounded-lg"
                    >
                      {m.name}
                    </span>
                  ))}
                  {trip.members.length > 6 && (
                    <span className="text-[11px] font-extrabold bg-stone-100 border border-stone-200/60 text-stone-400 px-3 py-1.5 rounded-lg">
                      +{trip.members.length - 6} more
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full border-t-2 border-dashed border-stone-200 mb-6"></div>

              <span className="text-[10px] font-black text-emerald-600/40 uppercase tracking-widest">
                powered by nest.
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
