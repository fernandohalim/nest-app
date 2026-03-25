"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { v4 as uuidv4 } from "uuid";
import ExpenseForm from "@/components/expense-form";
import { calculateSettlements } from "@/lib/settlements";
import { Expense } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export default function TripDetail() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

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

  const isOwner = Boolean(
    user?.id && trip?.owner_id && user.id === trip.owner_id,
  );
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    if (!user || !trip) return;
    if (isOwner) {
      setIsLinked(true);
      return;
    }
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
      alert("please sign in to save trips!");
      return;
    }

    if (isLinked) {
      // remove from dashboard
      await supabase
        .from("user_trips")
        .delete()
        .match({ user_id: user.id, trip_id: tripId });
      setIsLinked(false);
    } else {
      // save to dashboard
      await supabase
        .from("user_trips")
        .insert({ user_id: user.id, trip_id: tripId });
      setIsLinked(true);
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
              title: `✓ settled ${exp.title} directly`,
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

  if (isLoading && !trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-gray-500">loading trip details...</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-sm text-gray-500">trip not found.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-black underline"
        >
          go back home
        </button>
      </main>
    );
  }

  const handleShare = () => {
    const url = `${window.location.origin}/trip/${tripId}`;
    navigator.clipboard.writeText(url);
    alert("trip link copied! anyone with this link can view the details.");
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    addMember(tripId, { id: uuidv4(), name: newMemberName.trim() });
    setNewMemberName("");
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    const isTiedToExpense = trip.expenses.some(
      (exp) =>
        exp.paidBy[memberId] !== undefined ||
        exp.owedBy[memberId] !== undefined,
    );
    if (isTiedToExpense)
      return alert(
        `cannot remove ${memberName}. they are involved in existing expenses. please delete or edit those expenses first.`,
      );
    if (confirm(`remove ${memberName} from this trip?`))
      deleteMember(tripId, memberId);
  };

  const handleSaveExpense = (expense: Expense) => {
    if (editingExpense) updateExpense(tripId, expense.id, expense);
    else addExpense(tripId, expense);
    setIsAddingExpense(false);
    setEditingExpense(undefined);
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (confirm("delete this expense permanently?")) {
      deleteExpense(tripId, expenseId);
      setExpandedExpenseId(null);
    }
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

  const handleFullTripDelete = async () => {
    const confirmDelete = window.confirm(
      "are you sure you want to permanently delete this entire trip and all its expenses? this cannot be undone.",
    );
    if (confirmDelete) {
      await deleteTrip(tripId);
      router.push("/");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-8">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-black mt-1 shrink-0"
          >
            ← back
          </button>

          {/* Polished header with text truncation for long names */}
          <div className="flex flex-col items-center gap-1 flex-1 text-center px-4 min-w-0">
            <div className="flex items-center justify-center gap-2 w-full">
              <h1 className="text-xl font-medium tracking-tight truncate">
                {trip.name}
              </h1>
              {!isOwner && (
                <span className="shrink-0 text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium tracking-wide">
                  view only
                </span>
              )}
            </div>
            {trip.owner_name && (
              <span className="text-[10px] text-gray-400 truncate w-full">
                created by {trip.owner_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 shrink-0">
            {!isOwner && (
              <button
                onClick={handleToggleBookmark}
                className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                  isLinked
                    ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                    : "text-gray-400 bg-gray-50 hover:text-gray-900 hover:bg-gray-100"
                }`}
                title={isLinked ? "remove from dashboard" : "save to dashboard"}
              >
                {isLinked ? (
                  /* filled bookmark */
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                  </svg>
                ) : (
                  /* outline bookmark */
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                )}
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => {
                  setEditTripName(trip.name);
                  setShowSettings(true);
                }}
                className="text-gray-400 hover:text-gray-900 transition-colors"
                title="trip settings"
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
                    strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={handleShare}
              className="text-sm text-blue-500 font-medium hover:text-blue-700"
            >
              share
            </button>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-400 mb-3">members</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {trip.members.map((member) => (
              <div
                key={member.id}
                className={`pl-3 ${!isOwner ? "pr-3" : "pr-1"} py-1 bg-gray-100 rounded-full text-xs flex items-center gap-1`}
              >
                {member.name}
                {isOwner && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-200 rounded-full transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="add a friend..."
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium"
              >
                add
              </button>
            </form>
          )}
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-gray-400">expenses</h2>
            {isOwner && !isAddingExpense && !editingExpense && (
              <button
                onClick={() => {
                  if (trip.members.length === 0)
                    return alert("add a member first!");
                  setIsAddingExpense(true);
                }}
                className="text-xs px-3 py-1 bg-black text-white rounded-full"
              >
                + new
              </button>
            )}
          </div>

          {(isAddingExpense || editingExpense) && isOwner && (
            <div className="mb-6">
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
          )}

          <div className="space-y-3">
            {trip.expenses.length === 0 &&
            !isAddingExpense &&
            !editingExpense ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <span className="text-xs text-gray-400">no expenses yet.</span>
              </div>
            ) : (
              trip.expenses.map((exp) => {
                const payersEntries = Object.entries(exp.paidBy);
                const isMultiPayer = payersEntries.length > 1;

                const payerDisplay = isMultiPayer
                  ? payersEntries
                      .map(
                        ([id, amt]) =>
                          `${getMemberName(id)} ${amt.toLocaleString()}`,
                      )
                      .join(", ")
                  : getMemberName(payersEntries[0][0]);

                const isExpanded = expandedExpenseId === exp.id;
                const involvedCount = Object.keys(exp.owedBy).length;

                return (
                  <div
                    key={exp.id}
                    className="border border-gray-100 rounded-xl bg-gray-50 overflow-hidden transition-all"
                  >
                    <button
                      onClick={() =>
                        setExpandedExpenseId(isExpanded ? null : exp.id)
                      }
                      className="w-full flex justify-between items-center p-3 text-left"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium truncate">
                          {exp.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          paid by {payerDisplay}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {exp.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {exp.splitType === "exact"
                            ? "itemized"
                            : exp.splitType === "adjustment"
                              ? "adjusted"
                              : `split by ${involvedCount}`}{" "}
                          • {isExpanded ? "↑" : "↓"}
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-gray-100 bg-white">
                        <p className="text-xs text-gray-400 mb-3 font-medium">
                          split details:
                        </p>
                        <div className="space-y-4 mb-4">
                          {Object.entries(exp.owedBy).map(
                            ([memberId, amount]) => {
                              const isPayer = payersEntries.some(
                                ([id]) => id === memberId,
                              );
                              const canMarkPaid =
                                !isPayer && isOwner && !isMultiPayer;

                              const isSettled =
                                exp.settledShares?.[memberId] || false;
                              const extra = exp.adjustments?.[memberId];

                              const consumedItems: string[] = [];
                              let originalAmount: number | undefined =
                                undefined;

                              if (exp.splitType === "exact" && exp.items) {
                                originalAmount = 0;
                                exp.items.forEach((item) => {
                                  if (item.assignedTo.includes(memberId)) {
                                    originalAmount! +=
                                      item.price / item.assignedTo.length;
                                    const shareBadge =
                                      item.assignedTo.length > 1
                                        ? `(1/${item.assignedTo.length})`
                                        : "";
                                    consumedItems.push(
                                      `${item.name} ${shareBadge}`.trim(),
                                    );
                                  }
                                });
                              }

                              const hasAdjustment =
                                originalAmount !== undefined &&
                                Math.round(originalAmount) !==
                                  Math.round(amount);

                              return (
                                <div
                                  key={memberId}
                                  className="flex justify-between text-xs items-start"
                                >
                                  <div className="flex flex-col">
                                    <span
                                      className={`font-medium ${isSettled ? "text-gray-400" : "text-gray-800"}`}
                                    >
                                      {getMemberName(memberId)}
                                    </span>

                                    {consumedItems.length > 0 && (
                                      <div className="flex flex-col mt-1 space-y-0.5">
                                        {consumedItems.map((cItem, idx) => (
                                          <span
                                            key={idx}
                                            className="text-[10px] text-gray-500 flex items-center gap-1.5"
                                          >
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>{" "}
                                            {cItem}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    {extra ? (
                                      <span className="text-gray-400 mt-0.5">
                                        + {extra.toLocaleString()} extra
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
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
                                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${isSettled ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-black hover:border-black"}`}
                                        >
                                          {isSettled ? "paid ✓" : "mark paid"}
                                        </button>
                                      ) : (
                                        isSettled && (
                                          <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                                            paid ✓
                                          </span>
                                        )
                                      )}
                                      <span
                                        className={`font-medium ${isSettled ? "text-gray-400 line-through" : ""}`}
                                      >
                                        {Math.round(amount).toLocaleString()}
                                      </span>
                                    </div>
                                    {hasAdjustment && (
                                      <span className="text-[10px] text-gray-400 line-through mt-0.5">
                                        {originalAmount!.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>

                        {isOwner && (
                          <div className="flex gap-2 border-t border-gray-50 pt-3">
                            <button
                              onClick={() => {
                                setEditingExpense(exp);
                                setExpandedExpenseId(null);
                              }}
                              className="flex-1 text-xs py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                              edit
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="flex-1 text-xs py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                            >
                              delete
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

        {trip.expenses.length > 0 && (
          <section className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-gray-400">
                transparent ledger
              </h2>
              <button
                onClick={() => setShowLedger(!showLedger)}
                className="text-[10px] px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-medium"
              >
                {showLedger ? "hide details" : "show details"}
              </button>
            </div>

            {showLedger && (
              <div className="space-y-4">
                {trip.members.map((member) => {
                  const details = memberDetails[member.id];
                  if (
                    !details ||
                    (details.totalPaid === 0 && details.totalOwed === 0)
                  )
                    return null;
                  const net = Math.round(details.totalPaid - details.totalOwed);

                  return (
                    <div
                      key={member.id}
                      className="p-4 border border-gray-200 rounded-xl bg-white flex flex-col gap-3 shadow-sm"
                    >
                      <div className="flex justify-between items-center border-b border-gray-50 pb-3">
                        <span className="font-medium text-sm">
                          {member.name}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-md ${net > 0 ? "bg-green-50 text-green-700" : net < 0 ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}
                        >
                          {net > 0
                            ? "gets back "
                            : net < 0
                              ? "owes "
                              : "settled "}
                          {Math.abs(net).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-gray-400 mb-1">
                          payments made:
                        </span>
                        {details.paidItems.length === 0 ? (
                          <span className="text-gray-300 italic">-</span>
                        ) : (
                          details.paidItems.map((item, i) => (
                            <div
                              key={i}
                              className={`flex justify-between ${item.isNegative ? "text-red-500" : "text-gray-600"}`}
                            >
                              <span>{item.title}</span>
                              <span>
                                {Math.round(item.amount).toLocaleString()}
                              </span>
                            </div>
                          ))
                        )}
                        <div className="flex justify-between font-medium pt-1 mt-1 border-t border-gray-50">
                          <span>total payments</span>
                          <span>
                            {Math.round(details.totalPaid).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-xs mt-2 pt-3 border-t border-gray-50">
                        <span className="text-gray-400 mb-1">
                          their consumption:
                        </span>
                        {details.owedItems.length === 0 ? (
                          <span className="text-gray-300 italic">-</span>
                        ) : (
                          details.owedItems.map((item, i) => (
                            <div
                              key={i}
                              className={`flex justify-between items-start ${item.isSettled ? "text-gray-400 line-through" : "text-gray-600"}`}
                            >
                              <div className="flex flex-col flex-1 pr-2">
                                <span>
                                  {item.title} {item.isSettled ? "(paid)" : ""}
                                </span>

                                {item.subItems && item.subItems.length > 0 && (
                                  <div className="mt-1 flex flex-col gap-0.5">
                                    {item.subItems.map((sub, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] text-gray-400 leading-tight"
                                      >
                                        ↳ {sub}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.extra ? (
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    + {item.extra.toLocaleString()} extra
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex flex-col items-end">
                                <span>
                                  {Math.round(item.amount).toLocaleString()}
                                </span>
                                {item.originalAmount !== undefined &&
                                  Math.round(item.originalAmount) !==
                                    Math.round(item.amount) && (
                                    <span className="text-[10px] text-gray-400 line-through mt-0.5">
                                      {Math.round(
                                        item.originalAmount,
                                      ).toLocaleString()}
                                    </span>
                                  )}
                              </div>
                            </div>
                          ))
                        )}
                        <div className="flex justify-between font-medium pt-1 mt-1 border-t border-gray-50">
                          <span>total consumed</span>
                          <span>
                            {Math.round(details.totalOwed).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {unoptimizedDebts.length > 0 &&
          settlements.length !== unoptimizedDebts.length &&
          showLedger && (
            <section className="mt-4 pt-6 border-t border-gray-100">
              <h2 className="text-sm font-medium text-gray-400 mb-1">
                direct debts (unoptimized)
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                raw history of who owes who before the app simplifies the
                transfers.
              </p>
              <div className="space-y-2">
                {unoptimizedDebts.map((debt, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-700">
                        {getMemberName(debt.from)}
                      </span>
                      <span className="text-gray-400 text-xs">owes</span>
                      <span className="font-medium text-sm text-gray-700">
                        {getMemberName(debt.to)}
                      </span>
                    </div>
                    <span className="font-medium text-sm text-gray-700">
                      {Math.round(debt.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

        {settlements.length > 0 && (
          <section className="mt-8 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-medium text-gray-400 mb-1">
              how to settle up
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              the smartest way to pay everyone back using the fewest transfers.
            </p>
            <div className="space-y-3">
              {settlements.map((settlement, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-4 bg-black text-white rounded-lg shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {settlement.from.name}
                    </span>
                    <span className="text-gray-400 text-xs">pays</span>
                    <span className="font-medium text-sm">
                      {settlement.to.name}
                    </span>
                  </div>
                  <span className="font-medium text-sm">
                    {Math.round(settlement.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {showSettings && isOwner && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">trip settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-black"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRenameTrip} className="mb-8">
              <label className="block text-xs text-gray-500 mb-2">
                rename trip
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium"
                >
                  save
                </button>
              </div>
            </form>

            <div className="border-t border-red-100 pt-6">
              <h4 className="text-xs text-red-600 font-medium mb-1">
                danger zone
              </h4>
              <p className="text-xs text-gray-500 mb-4">
                this will permanently delete the trip and all expenses for
                everyone.
              </p>
              <button
                onClick={handleFullTripDelete}
                className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition-colors"
              >
                delete trip
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
