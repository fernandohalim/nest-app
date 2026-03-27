"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { v4 as uuidv4 } from "uuid";
import ExpenseForm from "@/components/expense-form";
import { calculateSettlements } from "@/lib/settlements";
import { Expense } from "@/lib/types";
import { supabase } from "@/lib/supabase";

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

export default function TripDetail() {
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
    isLoading,
    isSyncing,
  } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);

  useEffect(() => {
    fetchTrip(tripId);
    const unsubscribe = subscribeToTrip(tripId);
    return () => unsubscribe();
  }, [tripId, fetchTrip, subscribeToTrip]);

  const getMemberName = (id: string) =>
    trip?.members.find((m) => m.id === id)?.name || "unknown";

  const [newMemberName, setNewMemberName] = useState("");
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(
    undefined,
  );
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  const [showLedger, setShowLedger] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editTripName, setEditTripName] = useState("");

  const [sortBy, setSortBy] = useState<"newest" | "amount_high" | "amount_low">(
    "newest",
  );
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const processedExpenses = (trip?.expenses || [])
    .filter(
      (exp) => filterCategory === "all" || exp.category === filterCategory,
    )
    .sort((a, b) => {
      if (sortBy === "newest")
        return (
          new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()
        );
      if (sortBy === "amount_high") return b.totalAmount - a.totalAmount;
      if (sortBy === "amount_low") return a.totalAmount - b.totalAmount;
      return 0;
    });

  const usedCategories = Array.from(
    new Set((trip?.expenses || []).map((e) => e.category || "other")),
  );

  const isOwner = Boolean(
    user?.id && trip?.owner_id && user.id === trip.owner_id,
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
            myItems.forEach((i) => {
              const share =
                i.assignedTo.length > 1 ? `(1/${i.assignedTo.length})` : "";
              originalSum += i.price / i.assignedTo.length;
              subItems.push(`${i.name} ${share}`.trim());
            });
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
    navigator.clipboard.writeText(url);
    showAlert("link copied! send it to the group chat 📱", "copied! ✨");
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
    if (editingExpense) await updateExpense(tripId, expense.id, expense);
    else await addExpense(tripId, expense);
    setIsAddingExpense(false);
    setEditingExpense(undefined);
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

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-32 text-stone-800 font-sans selection:bg-emerald-200 selection:text-emerald-900">
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

        {/* super playful dynamic hero dashboard */}
        <div className="bg-emerald-700 text-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/15 mb-10 flex flex-col items-center text-center relative overflow-hidden group">
          {/* animated background blobs */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -ml-10 -mb-10 group-hover:translate-x-4 transition-transform duration-700"></div>

          <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-widest uppercase mb-4 relative z-10 border border-white/20">
            {trip.status === "finished" ? "🔒 vault locked" : "💸 active tab"}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight mb-2 relative z-10">
            {trip.name}
          </h1>

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

        {/* cute crew section with colorful pills */}
        <section className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-xl font-extrabold text-stone-800">
              the crew 🤘
            </h2>
            <span className="text-sm font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
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
                  {isOwner && trip.status !== "finished" && (
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

          {isOwner && trip.status !== "finished" && (
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
            <h2 className="text-xl font-extrabold text-stone-800">
              the tab 🧾
            </h2>
          </div>

          {trip.expenses.length > 0 && (
            <div className="flex gap-2 mb-5">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-sm border-2 border-stone-100 shadow-sm bg-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 flex-1 font-bold text-stone-600 transition-all appearance-none cursor-pointer"
              >
                <option value="all">all categories</option>
                {usedCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "newest" | "amount_high" | "amount_low",
                  )
                }
                className="text-sm border-2 border-stone-100 shadow-sm bg-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 flex-1 font-bold text-stone-600 transition-all appearance-none cursor-pointer"
              >
                <option value="newest">latest first</option>
                <option value="amount_high">highest $$</option>
                <option value="amount_low">lowest $$</option>
              </select>
            </div>
          )}

          <div className="space-y-4">
            {processedExpenses.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[2rem] shadow-sm border-2 border-dashed border-stone-200">
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

                return (
                  <div
                    key={exp.id}
                    className="bg-white rounded-[1.5rem] shadow-sm border-2 border-stone-100 overflow-hidden group hover:border-emerald-200 hover:shadow-md transition-all duration-300"
                  >
                    <button onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)} className="w-full flex justify-between items-center p-4 sm:p-5 text-left active:bg-stone-50 transition-colors gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="mb-1">
                          <p className="text-base sm:text-lg font-extrabold text-stone-800 truncate">{exp.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-bold text-stone-400">
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-stone-100 text-stone-500 rounded-md text-[9px] sm:text-[10px] tracking-widest uppercase shrink-0">{exp.category || "other"}</span>
                          <span className="truncate flex-1 min-w-0">• paid by <span className="text-stone-700">{payerDisplay}</span></span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <p className="text-lg sm:text-xl font-black text-emerald-600">{exp.totalAmount.toLocaleString()}</p>
                        <p className="text-[10px] sm:text-xs font-bold text-stone-400 mt-1 flex items-center justify-end gap-1">
                          {isExpanded ? "close" : "details"} 
                          <span className={`w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center bg-stone-100 rounded-full transition-transform duration-300 ${isExpanded ? "rotate-180 bg-emerald-100 text-emerald-600" : ""}`}>
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </span>
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-5 border-t-2 border-stone-100 bg-stone-50/50 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-3 mb-6">
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

                              return (
                                <div
                                  key={memberId}
                                  className="flex justify-between items-center bg-white p-3.5 rounded-2xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${getAvatarColor(getMemberName(memberId))}`}
                                    >
                                      {getInitials(getMemberName(memberId))}
                                    </div>
                                    <div className="flex flex-col">
                                      <span
                                        className={`text-sm font-extrabold ${isSettled ? "text-stone-400" : "text-stone-800"}`}
                                      >
                                        {getMemberName(memberId)}
                                      </span>
                                      {extra ? (
                                        <span className="text-[10px] text-stone-400 font-bold tracking-wide">
                                          +{extra.toLocaleString()} extra
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
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
                                    <span
                                      className={`font-black text-lg ${isSettled ? "text-stone-300 line-through decoration-2" : "text-stone-800"}`}
                                    >
                                      {Math.round(amount).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>

                        {isOwner && trip.status !== "finished" && (
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

        {/*  ledger */}
        {trip.expenses.length > 0 && (
          <section className="mt-14 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <div className="flex justify-between items-end mb-4 px-1">
              <h2 className="text-xl font-extrabold text-stone-800">
                who pays who 🤝
              </h2>
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
                  <div key={index} className="flex justify-between items-center p-4 sm:p-5 bg-stone-900 text-white rounded-[2rem] shadow-xl shadow-stone-900/10 relative z-10 hover:translate-x-2 transition-transform cursor-default gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.from.name)}`}>
                        {getInitials(settlement.from.name)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-base sm:text-lg truncate">{settlement.from.name}</span>
                        <span className="text-stone-400 font-bold text-[9px] sm:text-xs tracking-widest uppercase">pays</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-4 text-right flex-1 min-w-0 justify-end">
                      <div className="flex flex-col min-w-0 items-end">
                        <span className="font-extrabold text-base sm:text-lg text-emerald-400 truncate max-w-full">{Math.round(settlement.amount).toLocaleString()}</span>
                        <span className="text-stone-400 font-bold text-[9px] sm:text-xs tracking-widest uppercase truncate max-w-full">to {settlement.to.name}</span>
                      </div>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white ${getAvatarColor(settlement.to.name)}`}>
                        {getInitials(settlement.to.name)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* transparent detailed ledger logic is back! */}
            <div className="mt-8">
              <button
                onClick={() => setShowLedger(!showLedger)}
                className="w-full py-4 bg-white border-2 border-stone-200 rounded-2xl text-sm font-extrabold text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98]"
              >
                {showLedger
                  ? "hide the boring math ↑"
                  : "show me the boring math ↓"}
              </button>

              {showLedger && (
                <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
                        className="p-5 bg-white border-2 border-stone-100 rounded-[1.5rem] shadow-sm relative overflow-hidden"
                      >
                        {/* receipt style jagged edge top (decorative css hack) */}
                        <div className="absolute top-0 left-0 right-0 h-1 flex justify-around opacity-20">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-stone-400 rotate-45 -mt-1"
                            ></div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center border-b-2 border-dashed border-stone-200 pb-4 mb-4 mt-1">
                          <span className="font-extrabold text-lg text-stone-800">
                            {member.name}
                          </span>
                          <span
                            className={`text-xs font-black px-3 py-1.5 rounded-xl uppercase tracking-wider ${net > 0 ? "bg-emerald-100 text-emerald-700" : net < 0 ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-600"}`}
                          >
                            {net > 0 ? "gets " : net < 0 ? "owes " : "even "}
                            {Math.abs(net).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 text-xs font-bold text-stone-500 uppercase tracking-wide">
                          <div className="flex justify-between">
                            <span>total paid out</span>
                            <span className="text-stone-800 text-sm">
                              {Math.round(details.totalPaid).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>total consumed</span>
                            <span className="text-stone-800 text-sm">
                              {Math.round(details.totalOwed).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* magical bouncy FAB for new expense */}
      {!isAddingExpense && isOwner && trip.status !== "finished" && (
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
          className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 w-16 h-16 bg-stone-900 text-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.4)] flex items-center justify-center text-3xl pb-1 hover:bg-emerald-600 hover:scale-110 active:scale-90 transition-all duration-300 z-40 group"
        >
          <span className="group-hover:rotate-90 transition-transform duration-300">
            +
          </span>
        </button>
      )}

      {/* Bottom Sheet Modal for Expense Form */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[#fdfbf7] w-full max-w-md h-[92vh] sm:h-auto sm:max-h-[92vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative">
            {/* cute little drag handle line */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"></div>

            <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
              <h2 className="text-2xl font-black text-stone-800">
                {editingExpense ? "edit it ✏️" : "new tab 💸"}
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
              <label className="block text-sm font-bold text-stone-500 mb-2 ml-1">rename trip</label>
              <div className="flex gap-2 w-full">
                <input 
                  type="text" 
                  value={editTripName} 
                  onChange={(e) => setEditTripName(e.target.value)} 
                  className="flex-1 min-w-0 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all" 
                />
                <button type="submit" className="shrink-0 px-5 sm:px-6 py-3 sm:py-3.5 bg-stone-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-md">save</button>
              </div>
            </form>

            <div className="border-t-2 border-stone-100 pt-8 mb-8">
              <div className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl border-2 border-stone-100">
                <div>
                  <h4 className="text-base font-black text-stone-800">
                    lock trip 🔒
                  </h4>
                  <p className="text-xs font-bold text-stone-500 mt-1">
                    {trip.status === "finished"
                      ? "locked tight."
                      : "open for business."}
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
                🧨 nuke entire trip
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
