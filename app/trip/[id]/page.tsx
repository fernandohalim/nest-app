"use client";

import { useState, useEffect, useRef } from "react";
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

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => name.substring(0, 2).toLowerCase();

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function TripDetail() {
  const [showScanner, setShowScanner] = useState(false);
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const { showAlert, showConfirm } = useAlertStore();

  const {
    user,
    trips,
    addMember,
    deleteMember,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseSettled,
    fetchTrip,
    subscribeToTrip,
    renameTrip,
    deleteTrip,
    toggleCollaborative,
    isLoading,
    isSyncing,
  } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const lastActive = new Date(
    trip?.updatedAt || trip?.createdAt || Date.now(),
  ).getTime();
  const daysSinceActive = Math.floor(
    (Date.now() - lastActive) / (1000 * 60 * 60 * 24),
  );
  const daysLeft = Math.max(0, 7 - daysSinceActive);

  const isOwner = Boolean(
    user?.id && trip?.owner_id && user.id === trip.owner_id,
  );

  const canEdit = isOwner || (trip?.is_collaborative ?? false);

  useEffect(() => {
    fetchTrip(tripId);
    const unsubscribe = subscribeToTrip(tripId);
    return () => unsubscribe();
  }, [tripId, fetchTrip, subscribeToTrip]);

  const getMemberName = (id: string) =>
    trip?.members.find((m) => m.id === id)?.name || "unknown";

  const [newMemberName, setNewMemberName] = useState("");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(
    undefined,
  );
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  const [showLedger, setShowLedger] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editTripName, setEditTripName] = useState("");

  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "amount_high" | "amount_low"
  >("newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const processedExpenses = (trip?.expenses || [])
    .filter(
      (exp) => filterCategory === "all" || exp.category === filterCategory,
    )
    .sort((a, b) => {
      if (sortBy === "newest") {
        return (
          new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
        );
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime()
        );
      }
      if (sortBy === "amount_high") {
        return b.totalAmount - a.totalAmount;
      }
      // lowest amount first
      if (sortBy === "amount_low") {
        return a.totalAmount - b.totalAmount;
      }
      return 0;
    });

  const usedCategories = Array.from(
    new Set((trip?.expenses || []).map((e) => e.category || "other")),
  );

  const [isLinked, setIsLinked] = useState(false);

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
    if (!user) {
      router.push("/login");
      return;
    }

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

  const settlements = trip ? calculateSettlements(trip) : [];
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  type MemberDetail = {
    totalPaid: number;
    totalOwed: number;
    paidItems: { title: string; amount: number; isNegative?: boolean }[];
    owedItems: {
      title: string;
      amount: number;
      subItems?: string[];
      extra?: number;
      isSettled?: boolean;
      originalAmount?: number;
    }[];
  };

  const memberDetails: Record<string, MemberDetail> = {};
  const directDebtsGraph: Record<string, Record<string, number>> = {};

  if (trip) {
    trip.members.forEach((m) => {
      memberDetails[m.id] = {
        totalPaid: 0,
        totalOwed: 0,
        paidItems: [],
        owedItems: [],
      };
      directDebtsGraph[m.id] = {};
      trip.members.forEach((m2) => {
        directDebtsGraph[m.id][m2.id] = 0;
      });
    });

    trip.expenses.forEach((exp) => {
      const expBalances: Record<string, number> = {};
      trip.members.forEach((m) => (expBalances[m.id] = 0));

      Object.entries(exp.paidBy || {}).forEach(([pId, pAmt]) => {
        if (memberDetails[pId]) {
          memberDetails[pId].totalPaid += pAmt;
          memberDetails[pId].paidItems.push({ title: exp.title, amount: pAmt });
        }
      });

      const primaryPayerId = Object.keys(exp.paidBy || {})[0];

      Object.entries(exp.owedBy || {}).forEach(([id, amt]) => {
        if (memberDetails[id] && amt > 0) {
          memberDetails[id].totalOwed += amt;
          const isSettled = exp.settledShares?.[id] || false;

          const subItems: string[] = [];
          let originalSum = 0;

          if (exp.splitType === "exact" && exp.items) {
            const myItems = exp.items.filter((i) => i.assignedTo.includes(id));
            let myBaseSum = 0;

            myItems.forEach((i) => {
              const share =
                i.assignedTo.length > 1 ? `(1/${i.assignedTo.length})` : "";
              const baseShare = i.price / i.assignedTo.length;
              myBaseSum += baseShare;
              originalSum += baseShare;

              const priceStr = Math.round(baseShare).toLocaleString();
              subItems.push(`${i.name} ${share} • ${priceStr}`.trim());
            });

            const itemsSum = exp.items.reduce(
              (acc, item) => acc + item.price,
              0,
            );
            const difference = exp.totalAmount - itemsSum;

            if (Math.abs(difference) > 0) {
              const amountOwed = exp.owedBy[id] || 0;
              const extra = exp.adjustments?.[id] || 0;
              const diffShare = amountOwed - myBaseSum - extra;

              if (Math.abs(diffShare) >= 0.5) {
                const label = difference > 0 ? "tax & tip" : "global discount";
                const sign = diffShare > 0 ? "+" : "";
                subItems.push(
                  `${label} • ${sign}${Math.round(diffShare).toLocaleString()}`,
                );
              }
            }
          } else if (exp.splitType === "adjustment") {
            const extra = exp.adjustments?.[id] || 0;
            if (extra > 0) {
              const baseSplit = amt - extra;
              subItems.push(
                `debt after split • ${Math.round(baseSplit).toLocaleString()}`,
              );
              subItems.push(
                `adjusted bill • +${Math.round(extra).toLocaleString()}`,
              );
            }
          }

          memberDetails[id].owedItems.push({
            title: exp.title,
            amount: amt,
            subItems: subItems.length > 0 ? subItems : undefined,
            extra: exp.adjustments?.[id],
            isSettled,
            originalAmount: originalSum > 0 ? originalSum : undefined,
          });

          if (isSettled && primaryPayerId) {
            memberDetails[id].totalPaid += amt;
            memberDetails[id].paidItems.push({
              title: `✓ settled ${exp.title}`,
              amount: amt,
            });
            if (memberDetails[primaryPayerId]) {
              memberDetails[primaryPayerId].totalPaid -= amt;
              memberDetails[primaryPayerId].paidItems.push({
                title: `↓ received cash from ${getMemberName(id)} for ${exp.title}`,
                amount: -amt,
                isNegative: true,
              });
            }
          }
        }
      });

      Object.entries(exp.paidBy || {}).forEach(([id, amt]) => {
        expBalances[id] += amt;
      });
      Object.entries(exp.owedBy || {}).forEach(([id, amt]) => {
        expBalances[id] -= amt;
      });

      Object.entries(exp.settledShares || {}).forEach(([id, isSettled]) => {
        if (isSettled && exp.owedBy[id] && primaryPayerId) {
          expBalances[id] += exp.owedBy[id];
          expBalances[primaryPayerId] -= exp.owedBy[id];
        }
      });

      const dAmts = Object.keys(expBalances)
        .filter((id) => expBalances[id] < -0.01)
        .map((id) => ({ id, amt: Math.abs(expBalances[id]) }));
      const cAmts = Object.keys(expBalances)
        .filter((id) => expBalances[id] > 0.01)
        .map((id) => ({ id, amt: expBalances[id] }));

      let d = 0,
        c = 0;
      while (d < dAmts.length && c < cAmts.length) {
        const debtor = dAmts[d];
        const creditor = cAmts[c];
        const transfer = Math.min(debtor.amt, creditor.amt);
        directDebtsGraph[debtor.id][creditor.id] += transfer;
        debtor.amt -= transfer;
        creditor.amt -= transfer;
        if (debtor.amt < 0.01) d++;
        if (creditor.amt < 0.01) c++;
      }
    });
  }

  const unoptimizedDebts: { from: string; to: string; amount: number }[] = [];
  const seenPairs = new Set<string>();

  if (trip) {
    trip.members.forEach((m1) => {
      trip.members.forEach((m2) => {
        if (m1.id === m2.id) return;
        const pairKey = [m1.id, m2.id].sort().join("-");
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        const m1OwesM2 = directDebtsGraph[m1.id][m2.id];
        const m2OwesM1 = directDebtsGraph[m2.id][m1.id];
        const net = m1OwesM2 - m2OwesM1;

        if (net > 0.01)
          unoptimizedDebts.push({ from: m1.id, to: m2.id, amount: net });
        else if (net < -0.01)
          unoptimizedDebts.push({
            from: m2.id,
            to: m1.id,
            amount: Math.abs(net),
          });
      });
    });
  }

  const totalTripCost =
    trip?.expenses.reduce((sum, exp) => sum + exp.totalAmount, 0) || 0;

  if (isLoading && !trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7]">
        <div className="relative w-16 h-16 flex items-center justify-center mb-6">
          <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xl animate-pulse">🐣</span>
        </div>
        <p className="text-sm text-stone-500 font-bold tracking-wide">
          warming up the nest...
        </p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7]">
        <div className="text-6xl mb-6 grayscale opacity-50">🪹</div>
        <p className="text-sm text-stone-500 font-bold">
          hmm, couldn&apos;t find this trip.
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

  const handleShare = () => {
    const url = `${window.location.origin}/trip/${tripId}`;

    // craft the perfect message template
    const message = `hola! 👋 i created a trip for "${trip.name}" on nest to split our expenses.\n\ntap the link below to join the trip:\n${url}`;

    // copy the whole message to clipboard
    navigator.clipboard.writeText(message);

    // update the alert to reflect the new behavior
    showAlert(
      "invite message copied! paste it in the group chat 📱",
      "copied! ✨",
    );
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showAlert("you need to type a name first!", "whoops 😅");
      return;
    }
    addMember(tripId, { id: uuidv4(), name: newMemberName.trim() });
    setNewMemberName("");
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    const isTiedToExpense = trip.expenses.some(
      (exp) =>
        exp.paidBy[memberId] !== undefined ||
        exp.owedBy[memberId] !== undefined,
    );
    if (isTiedToExpense) {
      showAlert(
        `can't remove ${memberName} yet, they are part of an expense!`,
        "nope! 🙅‍♂️",
      );
      return;
    }

    showConfirm(
      `are you sure you want to remove ${memberName} from the trip?`,
      () => deleteMember(tripId, memberId),
      "remove friend? 👋",
      "yes, remove them",
    );
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

  interface RawReceiptItem {
    name: string;
    price: number;
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processReceiptFile = async (file: File) => {
    setScanProgress(0);
    setIsScanning(true);

    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 300);

    try {
      const base64Data = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: {
          imageBase64: base64Data,
          mimeType: file.type,
        },
      });

      if (error || data?.error) throw new Error("failed to scan");

      const formattedItems: ExpenseItem[] = data.items.map(
        (item: RawReceiptItem) => ({
          id: uuidv4(),
          name: item.name,
          price: item.price,
          assignedTo: [],
        }),
      );

      const totalScannedAmount =
        data.totalAmount ||
        formattedItems.reduce(
          (sum: number, item: ExpenseItem) => sum + item.price,
          0,
        );

      let parsedDate = new Date().toISOString();
      if (data.date) {
        parsedDate = data.date;
      }

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
        expenseDate: parsedDate,
        createdAt: new Date().toISOString(),
        category: data.category || "other",
      };

      clearInterval(progressInterval);
      setScanProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setEditingExpense(scannedExpense);
      setIsAddingExpense(true);
    } catch (error) {
      console.error("upload error:", error);
      clearInterval(progressInterval);
      showAlert(
        "couldn't read that receipt, try another one!",
        "scan failed ❌",
      );
    } finally {
      clearInterval(progressInterval);
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 300);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await processReceiptFile(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteExpense = (expenseId: string) => {
    showConfirm(
      "delete this expense permanently? it will recalculate everything.",
      () => {
        deleteExpense(tripId, expenseId);
        setExpandedExpenseId(null);
      },
      "delete expense? 🗑️",
      "yes, delete it",
    );
  };

  const handleRenameTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTripName.trim() || editTripName.trim() === trip?.name) {
      setShowSettings(false);
      return;
    }
    await renameTrip(tripId, editTripName.trim());
    setShowSettings(false);
  };

  const handleFullTripDelete = () => {
    showConfirm(
      "whoa there! are you sure you want to delete this whole trip and all its expenses? this can't be undone.",
      async () => {
        await deleteTrip(tripId);
        router.push("/");
      },
      "nuke entire trip? 🧨",
      "yes, destroy it",
    );
  };

  const getRawDebts = () => {
    if (!trip) return [];

    const raw: { from: string; to: string; amount: number }[] = [];

    trip.expenses.forEach((exp) => {
      const payers = Object.keys(exp.paidBy || {});
      if (payers.length === 0) return;
      const mainPayerId = payers[0];
      const mainPayer = trip.members.find((m) => m.id === mainPayerId);

      if (!mainPayer) return;

      Object.entries(exp.owedBy || {}).forEach(([oweId, amount]) => {
        if (oweId !== mainPayerId && amount > 0) {
          // ignore if they already settled this specific item
          if (exp.settledShares && exp.settledShares[oweId]) return;

          const debtor = trip.members.find((m) => m.id === oweId);
          if (!debtor) return;

          const existing = raw.find(
            (d) => d.from === debtor.name && d.to === mainPayer.name,
          );
          if (existing) {
            existing.amount += amount;
          } else {
            raw.push({ from: debtor.name, to: mainPayer.name, amount });
          }
        }
      });
    });

    return raw;
  };

  const rawDebts = getRawDebts();

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-40 text-stone-800 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* top navigation - bouncy buttons */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => router.push("/")}
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
            {!isOwner && (
              <button
                onClick={handleToggleBookmark}
                className={`w-11 h-11 rounded-full transition-all flex items-center justify-center hover:scale-110 hover:-translate-y-0.5 active:scale-95 ${
                  isLinked
                    ? "text-emerald-600 bg-emerald-100 border border-emerald-200"
                    : "text-stone-400 bg-white border border-stone-100 shadow-sm"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill={isLinked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-stone-100 shadow-sm text-stone-400 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
            {isOwner && (
              <button
                onClick={() => {
                  setEditTripName(trip.name);
                  setShowSettings(true);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-stone-100 shadow-sm text-stone-400 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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

        {/* fluid retention & status pill (high contrast version) */}
        <div className="mb-4 z-10 relative">
          <div
            className={`flex items-center w-full px-5 sm:px-6 py-3.5 shadow-sm backdrop-blur-xl border rounded-full transition-colors duration-500 ${
              trip.status === "finished"
                ? "bg-emerald-50 border-emerald-200"
                : daysLeft <= 2
                  ? "bg-rose-50 border-rose-200"
                  : "bg-white border-stone-200"
            }`}
          >
            <div className="relative flex items-center justify-center shrink-0 mr-4">
              {trip.status === "settled" ? (
                <span className="relative z-10 text-lg">✨</span>
              ) : daysLeft <= 2 ? (
                <span className="relative z-10 text-lg animate-pulse">⚠️</span>
              ) : (
                <span className="relative z-10 text-lg">⏳</span>
              )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 justify-center pt-0.5">
              <span
                className={`text-[11px] font-black tracking-widest uppercase leading-none truncate ${
                  trip.status === "finished"
                    ? "text-emerald-800"
                    : daysLeft <= 2
                      ? "text-rose-800"
                      : "text-stone-800"
                }`}
              >
                {trip.status === "finished"
                  ? "saved permanently"
                  : `expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
              </span>
              <span
                className={`text-[9px] font-bold mt-1 tracking-wider uppercase truncate ${
                  trip.status === "finished"
                    ? "text-emerald-600"
                    : daysLeft <= 2
                      ? "text-rose-600"
                      : "text-stone-500"
                }`}
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
              className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                trip.status === "finished"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : daysLeft <= 2
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800"
              }`}
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* super playful dynamic hero dashboard */}
        <div className="bg-emerald-700 text-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/15 mb-10 flex flex-col items-center text-center relative overflow-hidden group">
          {/* animated background blobs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -ml-10 -mb-10 group-hover:translate-x-4 transition-transform duration-700"></div>

          <div className="flex flex-wrap justify-center gap-2 mb-4 relative z-10">
            <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border border-white/20">
              {trip.status === "finished"
                ? "🔒 settled trip"
                : "💸 active trip"}
            </div>

            {/* NEW: Collaboration status badge so viewers know the rules! */}
            {trip.status !== "finished" && (
              <div
                className={`px-4 py-1.5 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase border flex items-center gap-1.5 transition-colors ${
                  trip.is_collaborative
                    ? "bg-emerald-400/30 border-emerald-300/50 text-white shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                    : "bg-black/20 border-white/10 text-stone-200"
                }`}
              >
                {trip.is_collaborative ? (
                  <>
                    <span>🤝</span> open to edit
                  </>
                ) : (
                  <>
                    <span>👀</span> view only
                  </>
                )}
              </div>
            )}
          </div>

          {/* sleek pre-header timestamp above the title */}
          <div className="text-[10px] sm:text-xs font-black tracking-widest text-emerald-200/80 uppercase mb-1.5 relative z-10 flex items-center justify-center gap-1.5">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {new Date(trip.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2 relative z-10">
            {trip.name}
          </h1>

          {/* cleaned up created by row */}
          <div className="text-xs font-bold text-emerald-100 mb-2 relative z-10 flex items-center justify-center gap-1.5">
            <span>created by</span>
            <span className="text-white bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-sm shadow-inner">
              {isOwner ? "you" : trip.owner_name || "the host"} 👑
            </span>
          </div>

          <div className="text-5xl font-black tracking-tighter relative z-10 my-2 drop-shadow-md">
            <span className="text-2xl text-emerald-200 align-top mr-1">rp</span>
            {totalTripCost.toLocaleString()}
          </div>

          <div className="flex items-center gap-2 mt-6 bg-black/25 px-5 py-2 rounded-full text-xs font-bold text-emerald-50 backdrop-blur-sm relative z-10 shadow-inner">
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin"></div>{" "}
                syncing magically ✨
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>{" "}
                safely saved in cloud
              </>
            )}
          </div>
        </div>

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

            <button
              onClick={() =>
                toggleCollaborative(trip.id, !trip.is_collaborative)
              }
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ease-in-out shadow-inner focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                trip.is_collaborative ? "bg-emerald-500" : "bg-stone-200"
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  trip.is_collaborative ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {/* cute crew section with colorful pills */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex justify-between items-end mb-4 px-1">
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
                className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 flex items-center justify-center transition-colors focus:outline-none"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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

            <span className="text-sm font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full shrink-0">
              {trip.members.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {trip.members.map((member) => {
              const colorClass = getAvatarColor(member.name);
              return (
                <div
                  key={member.id}
                  className="pl-1.5 pr-3 py-1.5 bg-white border-2 border-stone-100 shadow-sm rounded-full text-sm font-bold flex items-center gap-2 hover:-translate-y-1 hover:shadow-md hover:border-stone-200 transition-all cursor-default"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border ${colorClass}`}
                  >
                    {getInitials(member.name)}
                  </div>
                  <span className="text-stone-700">{member.name}</span>
                  {canEdit && trip.status !== "finished" && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-white hover:bg-rose-500 rounded-full transition-all active:scale-90 ml-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit && trip.status !== "finished" && (
            <form onSubmit={handleAddMember} className="flex gap-2 mt-5">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="type a name..."
                className="flex-1 bg-white border-2 border-stone-100 shadow-sm rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:font-medium placeholder:text-stone-300"
              />
              <button
                type="submit"
                className="px-6 py-3.5 bg-stone-900 text-white hover:bg-emerald-600 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95"
              >
                add +
              </button>
            </form>
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
                className="w-5 h-5 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 flex items-center justify-center transition-colors focus:outline-none"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
                <div className="text-5xl mb-4 animate-bounce inline-block">
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
                const payerDisplay = isMultiPayer
                  ? payersEntries
                      .map(([id]) => `${getMemberName(id)}`)
                      .join(", ")
                  : getMemberName(payersEntries[0][0]);
                const isExpanded = expandedExpenseId === exp.id;

                // calculate tax/tip differences for exact splits
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
                      className="w-full flex justify-between items-center p-4 sm:p-5 text-left active:bg-stone-50 transition-colors gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex flex-col">
                          <span className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-0.5">
                            {new Date(exp.expenseDate).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <p className="text-base sm:text-lg font-extrabold text-stone-800 truncate">
                            {exp.title}
                          </p>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-bold text-stone-400">
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-stone-100 text-stone-500 rounded-md text-[9px] sm:text-[10px] tracking-widest uppercase shrink-0">
                            {exp.category || "other"}
                          </span>

                          <span
                            className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[9px] sm:text-[10px] tracking-widest uppercase shrink-0 border ${
                              exp.splitType === "exact"
                                ? "border-indigo-100 text-indigo-500 bg-indigo-50"
                                : exp.splitType === "equal"
                                  ? "border-emerald-100 text-emerald-500 bg-emerald-50"
                                  : "border-amber-100 text-amber-500 bg-amber-50"
                            }`}
                          >
                            {exp.splitType === "exact"
                              ? "by item"
                              : exp.splitType === "equal"
                                ? "equally"
                                : "custom"}
                          </span>

                          <span className="truncate flex-1 min-w-0">
                            • paid by{" "}
                            <span className="text-stone-700">
                              {payerDisplay}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-lg sm:text-xl font-black text-emerald-600">
                          {exp.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 mt-1 flex items-center justify-end gap-1">
                          {isExpanded ? "close" : "details"}
                          <span
                            className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center bg-stone-100 rounded-full transition-transform duration-300 ${isExpanded ? "rotate-180 bg-emerald-100 text-emerald-600" : ""}`}
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
                        {/* itemized receipt section for exact splits */}
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
                                      {Math.round(item.price).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* tax/tip/discount banner */}
                              {Math.abs(difference) > 0 && (
                                <div className="p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl text-xs sm:text-sm font-bold text-amber-800 flex items-start gap-3 shadow-sm">
                                  <span className="text-xl leading-none">
                                    💡
                                  </span>
                                  <p className="leading-tight">
                                    subtotal is{" "}
                                    <span className="font-black">
                                      {Math.round(itemsSum).toLocaleString()}
                                    </span>
                                    . the extra{" "}
                                    <span className="font-black">
                                      {Math.round(
                                        Math.abs(difference),
                                      ).toLocaleString()}
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
                                isOwner &&
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
                                      .reduce(
                                        (acc, i) =>
                                          acc + i.price / i.assignedTo.length,
                                        0,
                                      )
                                  : 0;
                              const memberDiffShare =
                                amount - memberBaseSum - (extra || 0);

                              return (
                                <div
                                  key={memberId}
                                  className="flex flex-col bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                                >
                                  {/* 🔥 TOP ROW: Perfectly Centered Header 🔥 */}
                                  <div className="flex justify-between items-center w-full">
                                    {/* Left: Avatar & Name */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black border ${getAvatarColor(getMemberName(memberId))}`}
                                      >
                                        {getInitials(getMemberName(memberId))}
                                      </div>
                                      <span
                                        className={`text-sm sm:text-base font-extrabold truncate ${isSettled ? "text-stone-400" : "text-stone-800"}`}
                                      >
                                        {getMemberName(memberId)}
                                      </span>
                                    </div>

                                    {/* Right: Button & Total */}
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
                                          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${
                                            isSettled
                                              ? "bg-emerald-50 text-emerald-600 hover:bg-rose-50 hover:text-rose-600"
                                              : "bg-stone-100 text-stone-600 hover:bg-emerald-100 hover:text-emerald-700"
                                          }`}
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
                                          {Math.round(amount).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 🔥 BOTTOM ROW: Indented Details 🔥 */}
                                  {((exp.splitType === "exact" && exp.items) ||
                                    extra) && (
                                    <div className="pl-[44px] w-full flex flex-col gap-1 mt-2">
                                      {exp.splitType === "exact" &&
                                        exp.items && (
                                          <>
                                            {exp.items
                                              .filter((i) =>
                                                i.assignedTo.includes(memberId),
                                              )
                                              .map((i) => {
                                                const baseShare =
                                                  i.price / i.assignedTo.length;
                                                return (
                                                  <span
                                                    key={i.id}
                                                    className="text-[11px] font-bold text-stone-400 leading-tight flex justify-between gap-3"
                                                  >
                                                    <span className="truncate">
                                                      ↳ {i.name}
                                                    </span>
                                                    <span className="shrink-0 text-stone-300">
                                                      {Math.round(
                                                        baseShare,
                                                      ).toLocaleString()}
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
                                                      : ""}
                                                    {Math.round(
                                                      memberDiffShare,
                                                    ).toLocaleString()}
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
                                                {Math.round(
                                                  amount - extra,
                                                ).toLocaleString()}
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
                                                +
                                                {Math.round(
                                                  extra,
                                                ).toLocaleString()}
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
                                              +
                                              {Math.round(
                                                extra,
                                              ).toLocaleString()}
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

                        {canEdit && trip.status !== "finished" && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setEditingExpense(exp);
                                setExpandedExpenseId(null);
                                setIsAddingExpense(true);
                              }}
                              className="flex-1 text-sm font-bold py-3 bg-white border-2 border-stone-200 text-stone-700 hover:border-stone-800 hover:bg-stone-800 hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm"
                            >
                              ✏️ edit
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="flex-1 text-sm font-bold py-3 bg-white border-2 border-rose-100 text-rose-500 hover:border-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all active:scale-95 shadow-sm"
                            >
                              🗑️ delete
                            </button>
                          </div>
                        )}
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-stone-800">
                  who pays who 🤝
                </h2>
                <button
                  onClick={() => setShowSettlementModal(true)}
                  className="w-6 h-6 rounded-full bg-stone-200 text-stone-500 hover:bg-stone-300 hover:text-stone-700 flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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

            {settlements.length === 0 ? (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 text-center transform hover:rotate-1 transition-transform">
                <div className="text-4xl mb-2">⚖️</div>
                <span className="text-emerald-800 font-extrabold text-base">
                  everything is perfectly balanced!
                </span>
                <p className="text-emerald-600 font-bold text-xs mt-1">
                  no one owes anyone a dime.
                </p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div className="absolute left-6 top-6 bottom-6 w-1 bg-stone-200 rounded-full z-0"></div>
                {settlements.map((settlement, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 sm:p-5 bg-stone-900 text-white rounded-4xl shadow-xl shadow-stone-900/10 relative z-10 hover:translate-x-2 transition-transform cursor-default gap-2"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.from.name)}`}
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
                          {Math.round(settlement.amount).toLocaleString()}
                        </span>
                        <span className="text-stone-400 font-bold text-[9px] sm:text-xs tracking-widest uppercase truncate max-w-full">
                          to {settlement.to.name}
                        </span>
                      </div>
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.to.name)}`}
                      >
                        {getInitials(settlement.to.name)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* transparent detailed ledger logic */}
            <div className="mt-8">
              <button
                onClick={() => setShowLedger(!showLedger)}
                className="w-full py-4 bg-white border-2 border-stone-200 rounded-2xl text-sm font-extrabold text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98]"
              >
                {showLedger ? "hide ledger details ↑" : "show ledger details ↓"}
              </button>

              {showLedger && (
                <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* ... YOUR EXISTING LEDGER MAPPING LOGIC GOES HERE (no changes needed) ... */}
                  {trip.members.map((member) => {
                    const details = memberDetails[member.id];
                    if (
                      !details ||
                      (details.totalPaid === 0 && details.totalOwed === 0)
                    )
                      return null;
                    const net = Math.round(
                      details.totalPaid - details.totalOwed,
                    );

                    return (
                      <div
                        key={member.id}
                        className="p-6 bg-white border-2 border-stone-100 rounded-4xl shadow-sm relative overflow-hidden hover:border-emerald-200 transition-colors"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1.5 flex justify-around opacity-20">
                          {Array.from({ length: 30 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-2.5 h-2.5 bg-stone-400 rotate-45 -mt-1.5"
                            ></div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pb-5 mb-5 mt-2 border-b-2 border-stone-100">
                          <span className="font-black text-xl text-stone-800">
                            {member.name}
                          </span>
                          <span
                            className={`text-xs font-black px-3.5 py-1.5 rounded-xl uppercase tracking-widest border-2 ${net > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-stone-50 text-stone-500 border-stone-200"}`}
                          >
                            {net > 0 ? "gets " : net < 0 ? "owes " : "even "}
                            {Math.abs(net).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex gap-3 mb-6">
                          <div className="flex-1 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 flex flex-col gap-1">
                            <span className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest">
                              total paid out
                            </span>
                            <span className="font-black text-emerald-700">
                              {Math.round(details.totalPaid).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex-1 bg-stone-50 border border-stone-100 rounded-2xl p-3 flex flex-col gap-1">
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">
                              total consumed
                            </span>
                            <span className="font-black text-stone-700">
                              {Math.round(details.totalOwed).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="w-full border-t-2 border-dashed border-stone-200 mb-6"></div>
                        <div className="space-y-6">
                          {/* PAID ITEMS */}
                          {details.paidItems.length > 0 && (
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                💳 paid for
                              </span>
                              <div className="flex flex-col gap-2">
                                {details.paidItems.map((item, idx) => (
                                  <div
                                    key={`paid-${idx}`}
                                    className="flex justify-between items-start gap-4 text-sm"
                                  >
                                    <span
                                      className={`font-bold flex-1 leading-tight ${item.isNegative ? "text-stone-400 italic" : "text-stone-700"}`}
                                    >
                                      {item.title}
                                    </span>
                                    <span
                                      className={`font-black shrink-0 ${item.isNegative ? "text-stone-400" : "text-emerald-700"}`}
                                    >
                                      {item.isNegative ? "-" : "+"}
                                      {Math.abs(item.amount).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* OWED ITEMS */}
                          {details.owedItems.length > 0 && (
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                🍕 consumed
                              </span>
                              <div className="flex flex-col gap-4">
                                {details.owedItems.map((item, idx) => (
                                  <div
                                    key={`owed-${idx}`}
                                    className={`flex flex-col gap-1 text-sm w-full ${item.isSettled ? "opacity-60 grayscale" : ""}`}
                                  >
                                    {/* 🔥 TOP ROW: Title & Final Amount Aligned 🔥 */}
                                    <div className="flex justify-between items-start gap-4 w-full">
                                      <span
                                        className={`font-bold text-stone-700 leading-tight ${item.isSettled ? "line-through decoration-stone-400 decoration-2" : ""}`}
                                      >
                                        {item.title}
                                      </span>
                                      <div className="flex flex-col items-end shrink-0 gap-1">
                                        <span
                                          className={`font-black ${item.isSettled ? "text-stone-400 line-through decoration-2" : "text-stone-800"}`}
                                        >
                                          {Math.round(
                                            item.amount,
                                          ).toLocaleString()}
                                        </span>
                                        {item.isSettled && (
                                          <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-0.5">
                                            settled ✓
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* 🔥 BOTTOM ROW: Sub Items perfectly justified 🔥 */}
                                    {item.subItems &&
                                      item.subItems.length > 0 && (
                                        <div className="flex flex-col mt-0.5 w-full gap-1">
                                          {item.subItems.map((sub, sIdx) => {
                                            const [namePart, pricePart] =
                                              sub.split(" • ");

                                            let textColor = "text-stone-400";
                                            let priceColor = "text-stone-300";
                                            let arrowColor = "text-stone-300";

                                            if (
                                              namePart.includes(
                                                "global discount",
                                              )
                                            ) {
                                              textColor = "text-emerald-500/80";
                                              priceColor = "text-emerald-500";
                                              arrowColor =
                                                "text-emerald-400/50";
                                            } else if (
                                              namePart.includes("tax & tip") ||
                                              namePart.includes("adjusted bill")
                                            ) {
                                              textColor = "text-amber-500/80";
                                              priceColor = "text-amber-500";
                                              arrowColor = "text-amber-400/50";
                                            }

                                            return (
                                              <div
                                                key={sIdx}
                                                className={`text-[11px] font-bold flex justify-between gap-3 leading-tight w-full ${textColor}`}
                                              >
                                                <span className="truncate flex items-center gap-1.5">
                                                  <span className={arrowColor}>
                                                    ↳
                                                  </span>
                                                  {namePart}
                                                </span>
                                                {pricePart && (
                                                  <span
                                                    className={`shrink-0 ${priceColor}`}
                                                  >
                                                    {pricePart}
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* THE BEFORE/AFTER EXPLANATION MODAL */}
            {showSettlementModal && (
              <div className="fixed inset-0 z-100 flex items-center justify-center px-4">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
                  onClick={() => setShowSettlementModal(false)}
                />

                {/* Modal Content */}
                <div className="relative bg-white w-full max-w-md rounded-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl">
                        ✨
                      </div>
                      <button
                        onClick={() => setShowSettlementModal(false)}
                        className="w-8 h-8 bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-700 rounded-full flex items-center justify-center transition-colors"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <h3 className="text-2xl font-black text-stone-800 leading-tight mb-2">
                      debt simplification
                    </h3>
                    <p className="text-stone-500 font-bold text-sm leading-relaxed mb-6">
                      nest automatically optimizes the group&apos;s debts.
                      instead of everyone paying each other back for every
                      single receipt, we minimize the total number of
                      transactions.
                    </p>

                    <div className="space-y-6">
                      {/* Before State */}
                      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 block">
                          before (raw debts)
                        </span>
                        {rawDebts.length === 0 ? (
                          <span className="text-sm font-bold text-stone-400">
                            no debts to show.
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {rawDebts.map((debt, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs"
                              >
                                <span className="font-bold text-stone-600">
                                  {debt.from} owes {debt.to}
                                </span>
                                <span className="font-black text-stone-400">
                                  {Math.round(debt.amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center -my-3 relative z-10">
                        <div className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-400 shadow-sm">
                          ↓
                        </div>
                      </div>

                      {/* After State */}
                      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                        <span className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-3 block">
                          after (optimized by nest)
                        </span>
                        {settlements.length === 0 ? (
                          <span className="text-sm font-bold text-emerald-600">
                            everything is settled!
                          </span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {settlements.map((s, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs"
                              >
                                <span className="font-bold text-emerald-800">
                                  {s.from.name} pays {s.to.name}
                                </span>
                                <span className="font-black text-emerald-600">
                                  {Math.round(s.amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-stone-50 border-t border-stone-100">
                    <button
                      onClick={() => setShowSettlementModal(false)}
                      className="w-full py-3.5 bg-stone-900 text-white font-extrabold rounded-full hover:bg-stone-800 active:scale-[0.98] transition-all"
                    >
                      got it
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* hidden file input for the receipt scanner */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* sleek modern floating action menu */}
      {!isAddingExpense && canEdit && trip.status !== "finished" && (
        <div className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 flex flex-col gap-3 z-40 items-end animate-in slide-in-from-bottom-8 duration-500">
          {/* ultra-premium scan receipt pill */}
          <button
            onClick={() => {
              if (trip.members.length === 0) {
                showAlert(
                  "you need to add some friends to the tab first!",
                  "lonely trip? 🧍",
                );
                return;
              }
              setShowScanner(true);
            }}
            disabled={isScanning}
            className="group relative active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:active:scale-100"
          >
            {/* animated gradient border behind the button */}
            <div className="absolute -inset-0.5 rounded-full bg-linear-to-r from-emerald-400 via-teal-300 to-emerald-500 opacity-70 group-hover:opacity-100 blur-sm transition-opacity duration-500"></div>

            {/* the actual glass button */}
            <div className="relative flex items-center gap-3 pl-6 pr-2 py-2 bg-white/90 backdrop-blur-xl rounded-full border border-white/50 shadow-[0_8px_16px_rgb(0,0,0,0.05)]">
              <span className="text-xs font-black tracking-widest bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent uppercase group-hover:from-emerald-500 group-hover:to-teal-500 transition-all">
                scan receipt
              </span>
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-emerald-50 to-teal-50 shadow-inner flex items-center justify-center text-emerald-600 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
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
            </div>
          </button>

          {/* add manual pill */}
          <button
            onClick={() => {
              if (trip.members.length === 0) {
                showAlert(
                  "you need to add some friends to the tab first!",
                  "lonely trip? 🧍",
                );
                return;
              }
              setIsAddingExpense(true);
            }}
            className="flex items-center gap-3 pl-6 pr-2 py-2 bg-stone-900 text-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:bg-emerald-600 active:scale-95 transition-all duration-300 group"
          >
            <span className="text-xs font-black tracking-widest uppercase">
              manual
            </span>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors shadow-inner">
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

      {/* cute scanning overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden">
            <div className="text-4xl relative z-10">📝</div>
            {/* scanning laser animation inline */}
            <div
              className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] z-20"
              style={{ animation: "scan 1.5s ease-in-out infinite" }}
            >
              <style>{`
                @keyframes scan {
                  0% { top: 0; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
              `}</style>
            </div>
          </div>

          <h3 className="text-xl font-black text-white tracking-wide mb-4">
            reading receipt...
          </h3>

          {/* new: sleek progress bar */}
          <div className="w-48 sm:w-64 bg-stone-800 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner border border-stone-700">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${scanProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          {/* new: glowing percentage number */}
          <p className="text-emerald-400 font-black text-sm mb-1 tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
            {scanProgress}%
          </p>

          <p className="text-stone-400 font-bold text-xs mt-2 uppercase tracking-widest">
            crunching the numbers
          </p>
        </div>
      )}

      {/* Bottom Sheet Modal for Expense Form */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[#fdfbf7] w-full max-w-md h-[92vh] sm:h-auto sm:max-h-[92vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative">
            {/* cute little drag handle line */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"></div>

            <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
              <h2 className="text-2xl font-black text-stone-800">
                {editingExpense ? "edit expense ✏️" : "new expense 💸"}
              </h2>
              <button
                onClick={() => {
                  setIsAddingExpense(false);
                  setEditingExpense(undefined);
                }}
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
              />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && isOwner && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-stone-800">
                trip settings ⚙️
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRenameTrip} className="mb-8">
              <label className="block text-sm font-bold text-stone-500 mb-2 ml-1">
                rename trip
              </label>
              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  className="flex-1 min-w-0 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all"
                />
                <button
                  type="submit"
                  className="shrink-0 px-5 sm:px-6 py-3 sm:py-3.5 bg-stone-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-md"
                >
                  save
                </button>
              </div>
            </form>

            <div className="border-t-2 border-stone-100 pt-8 mb-8">
              <div className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl border-2 border-stone-100">
                <div>
                  <h4 className="text-base font-black text-stone-800">
                    mark trip as settled 🔒
                  </h4>
                  <p className="text-xs font-bold text-stone-500 mt-1">
                    {trip.status === "finished"
                      ? "re-open the trip?"
                      : "mark as late trip?"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await useTripStore
                      .getState()
                      .updateTripStatus(
                        tripId,
                        trip.status === "finished" ? "ongoing" : "finished",
                      );
                    setShowSettings(false);
                  }}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors active:scale-95 ${trip.status === "finished" ? "bg-emerald-500" : "bg-stone-300"}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${trip.status === "finished" ? "translate-x-7" : "translate-x-1"}`}
                  />
                </button>
              </div>
            </div>

            <div className="border-t-2 border-rose-100 pt-8">
              <button
                onClick={handleFullTripDelete}
                className="w-full py-4 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-500 hover:text-white rounded-2xl text-sm font-black transition-all active:scale-95 shadow-sm"
              >
                🧨 delete entire trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* custom camera scanner modal */}
      {showScanner && (
        <CameraScanner
          onClose={() => setShowScanner(false)}
          onUploadFallback={() => {
            setShowScanner(false);
            // wait 100ms for modal to fade out, then open native file picker
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 100);
          }}
          onCapture={(file) => {
            setShowScanner(false);
            // send the snapped photo directly to our new generic function!
            processReceiptFile(file);
          }}
        />
      )}
    </main>
  );
}
