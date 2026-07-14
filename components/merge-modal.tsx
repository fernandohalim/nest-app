"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { supabase } from "@/lib/supabase";
import { Member } from "@/lib/types";
import {
  MergeSourceSplit,
  ResolvedMember,
  buildInitialResolution,
  buildExpensePayloads,
  membersToInsert,
} from "@/lib/merge";
import { getAvatarColor, getInitials } from "@/lib/avatars";
import { CURRENCIES } from "./create-trip-modal";
import CustomSelect from "./custom-select";

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
}

type Step = "target" | "members";
type TargetMode = "new" | "existing";

export default function MergeModal({
  isOpen,
  onClose,
  selectedIds,
}: MergeModalProps) {
  const router = useRouter();
  const user = useTripStore((s) => s.user);
  const trips = useTripStore((s) => s.trips);
  const mergeQuickSplits = useTripStore((s) => s.mergeQuickSplits);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [step, setStep] = useState<Step>("target");
  const [targetMode, setTargetMode] = useState<TargetMode>("new");
  const [newTripName, setNewTripName] = useState("");
  const [newTripCurrency, setNewTripCurrency] = useState("IDR");
  const [existingTripId, setExistingTripId] = useState<string | null>(null);

  const [splits, setSplits] = useState<MergeSourceSplit[]>([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [resolved, setResolved] = useState<ResolvedMember[]>([]);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const idsKey = selectedIds.join(",");

  // reset every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep("target");
    setTargetMode("new");
    setNewTripName("");
    setNewTripCurrency("IDR");
    setExistingTripId(null);
    setResolved([]);
    setMergingId(null);
    setSubmitting(false);
  }, [isOpen, idsKey]);

  // pull the full data we need for each selected split
  useEffect(() => {
    if (!isOpen || selectedIds.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoadingSplits(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("id, title, ephemeral_members, paid_by, owed_by, adjustments, items")
        .in("id", selectedIds);
      if (cancelled) return;
      if (data && !error) {
        setSplits(
          data.map((r) => ({
            id: r.id,
            title: r.title,
            ephemeralMembers: (r.ephemeral_members as Member[]) || [],
            paidBy: r.paid_by || {},
            owedBy: r.owed_by || {},
            adjustments: r.adjustments || null,
            items: r.items || null,
          })),
        );
      }
      setLoadingSplits(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, idsKey, selectedIds]);

  // original name for each source member — needed to re-label on split-apart
  const nameLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const split of splits) {
      for (const m of split.ephemeralMembers) {
        map.set(`${split.id}:${m.id}`, m.name);
      }
    }
    return map;
  }, [splits]);

  const ownedTrips = useMemo(
    () => trips.filter((t) => t.owner_id === user?.id),
    [trips, user?.id],
  );

  // titles of the receipts a resolved member came from, for the subtitle
  const splitTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of splits) map.set(s.id, s.title);
    return map;
  }, [splits]);

  if (!isOpen) return null;

  const goToMembers = async () => {
    if (targetMode === "new" && !newTripName.trim()) {
      showAlert("give your new trip a name first!", "almost there ✨");
      return;
    }
    if (targetMode === "existing" && !existingTripId) {
      showAlert("pick a trip to merge into.", "which one? 🤔");
      return;
    }
    if (splits.length === 0) return;

    setPreparing(true);
    let existingMembers: Member[] = [];
    if (targetMode === "existing" && existingTripId) {
      const { data } = await supabase
        .from("members")
        .select("id, name")
        .eq("trip_id", existingTripId);
      existingMembers = (data as Member[]) || [];
    }
    setResolved(buildInitialResolution(splits, user?.id || "", existingMembers));
    setPreparing(false);
    setStep("members");
  };

  const mergePair = (id1: string, id2: string) => {
    setResolved((prev) => {
      const a = prev.find((r) => r.id === id1);
      const b = prev.find((r) => r.id === id2);
      if (!a || !b || a.id === b.id) return prev;
      if (a.isExisting && b.isExisting) {
        showAlert(
          "those are both members of the trip already — merge a receipt person into one of them instead.",
          "hold on 🤔",
        );
        return prev;
      }
      const survivor = a.isExisting ? a : b;
      const absorbed = survivor.id === a.id ? b : a;
      return prev
        .map((r) =>
          r.id === survivor.id
            ? { ...r, sources: [...r.sources, ...absorbed.sources] }
            : r,
        )
        .filter((r) => r.id !== absorbed.id);
    });
    setMergingId(null);
  };

  const splitApart = (id: string) => {
    setResolved((prev) => {
      const target = prev.find((r) => r.id === id);
      if (!target) return prev;
      const spun: ResolvedMember[] = target.sources.map((s) => ({
        id: uuidv4(),
        name: nameLookup.get(`${s.splitId}:${s.memberId}`) || target.name,
        isExisting: false,
        sources: [s],
      }));
      if (target.isExisting) {
        return [
          ...prev.map((r) => (r.id === id ? { ...r, sources: [] } : r)),
          ...spun,
        ];
      }
      return [...prev.filter((r) => r.id !== id), ...spun];
    });
  };

  const renameResolved = (id: string, name: string) =>
    setResolved((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name } : r)),
    );

  const handleConfirm = async () => {
    const withSources = resolved.filter((r) => r.sources.length > 0);
    if (withSources.length === 0) {
      showAlert("no members to merge — something went wrong.", "hmm 🤔");
      return;
    }
    if (withSources.some((r) => !r.name.trim())) {
      showAlert("every person needs a name before merging.", "quick fix ✏️");
      return;
    }

    setSubmitting(true);
    try {
      const expenses = buildExpensePayloads(splits, resolved);
      const newMembers = membersToInsert(resolved);
      const tripId = await mergeQuickSplits({
        targetTripId: targetMode === "existing" ? existingTripId : null,
        newTrip:
          targetMode === "new"
            ? { name: newTripName.trim(), currency: newTripCurrency }
            : undefined,
        newMembers,
        expenses,
      });
      onClose();
      router.push(`/trip/${tripId}`);
    } catch (err) {
      console.error(err);
      showAlert("couldn't finish the merge. please try again.", "error ❌");
      setSubmitting(false);
    }
  };

  // members that carry receipt data (existing trip members with no sources are
  // just merge targets and are shown, but don't need name validation)
  const activeMembers = resolved.filter(
    (r) => r.sources.length > 0 || r.isExisting,
  );

  return (
    <div
      className="fixed inset-0 z-70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-modal-title"
    >
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div className="relative w-full max-w-md bg-[#fdfbf7] rounded-t-[2.5rem] sm:rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 border border-stone-100">
        {/* header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-3">
            {step === "members" && (
              <button
                onClick={() => setStep("target")}
                aria-label="back"
                className="w-9 h-9 flex items-center justify-center bg-stone-50 border border-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-all active:scale-90"
              >
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              <h3
                id="merge-modal-title"
                className="text-xl font-black text-stone-800"
              >
                merge receipts 🪄
              </h3>
              <p className="text-xs font-bold text-stone-400 mt-0.5">
                {step === "target"
                  ? `${selectedIds.length} receipt${selectedIds.length !== 1 ? "s" : ""} → a trip`
                  : "sort out who's who"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="w-10 h-10 flex items-center justify-center bg-stone-50 border border-stone-100 rounded-full text-stone-400 hover:text-stone-800 transition-all active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 flex-1">
          {step === "target" ? (
            <div className="space-y-5">
              {/* target mode toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl">
                <button
                  onClick={() => setTargetMode("new")}
                  className={`py-2.5 rounded-xl text-sm font-black transition-all ${
                    targetMode === "new"
                      ? "bg-white text-stone-800 shadow-sm"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  🎒 new trip
                </button>
                <button
                  onClick={() => setTargetMode("existing")}
                  className={`py-2.5 rounded-xl text-sm font-black transition-all ${
                    targetMode === "existing"
                      ? "bg-white text-stone-800 shadow-sm"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  📂 existing
                </button>
              </div>

              {targetMode === "new" ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                      trip name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. friday night out 🌃"
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      className="w-full bg-white border-2 border-stone-100 shadow-sm rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 text-stone-800 placeholder:text-stone-300 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2 relative z-20">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                      currency
                    </label>
                    <CustomSelect
                      value={newTripCurrency}
                      onChange={setNewTripCurrency}
                      options={CURRENCIES}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                    pick a trip
                  </label>
                  {ownedTrips.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-stone-200 rounded-3xl text-center bg-white/50">
                      <p className="text-sm font-bold text-stone-400">
                        you don&apos;t own any trips yet. create a new one
                        instead!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {ownedTrips.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setExistingTripId(t.id)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                            existingTripId === t.id
                              ? "bg-emerald-50 border-emerald-300"
                              : "bg-white border-stone-100 hover:border-stone-200"
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-stone-800 truncate">
                              {t.name}
                            </span>
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider">
                              {t.currency} · {t.status}
                            </span>
                          </div>
                          {existingTripId === t.id && (
                            <span className="text-emerald-500 text-xl shrink-0">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3 text-xs font-bold text-emerald-700/80 leading-relaxed">
                everyone starts separate. if the same person shows up under
                different names (like{" "}
                <span className="font-black">jo</span> &{" "}
                <span className="font-black">jonathan</span>), merge them into
                one 👇
              </div>

              {activeMembers.map((r) => {
                const isMergeSource = mergingId === r.id;
                const isMergeTarget = mergingId !== null && mergingId !== r.id;
                const sourceTitles = Array.from(
                  new Set(
                    r.sources
                      .map((s) => splitTitleById.get(s.splitId) || "")
                      .filter(Boolean),
                  ),
                );
                const canSplit =
                  r.sources.length > 1 || (r.isExisting && r.sources.length > 0);

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (isMergeTarget) mergePair(mergingId!, r.id);
                    }}
                    className={`bg-white p-3 border-2 rounded-2xl shadow-sm transition-all ${
                      isMergeSource
                        ? "border-emerald-400 ring-4 ring-emerald-100"
                        : isMergeTarget
                          ? "border-dashed border-emerald-300 cursor-pointer hover:bg-emerald-50"
                          : "border-stone-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${getAvatarColor(r.name)}`}
                        aria-hidden="true"
                      >
                        {getInitials(r.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          value={r.name}
                          onChange={(e) => renameResolved(r.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="member name"
                          className="w-full bg-transparent font-extrabold text-stone-700 focus:outline-none focus:bg-stone-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5 px-0.5">
                          {r.isExisting && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-500 px-1.5 py-0.5 rounded">
                              in trip
                            </span>
                          )}
                          {r.sources.length > 1 && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded">
                              merged ×{r.sources.length}
                            </span>
                          )}
                          {sourceTitles.length > 0 && (
                            <span className="text-[10px] font-bold text-stone-400 truncate">
                              {sourceTitles.join(", ")}
                            </span>
                          )}
                          {r.isExisting && r.sources.length === 0 && (
                            <span className="text-[10px] font-bold text-stone-400">
                              trip member
                            </span>
                          )}
                        </div>
                      </div>

                      {!isMergeTarget && (
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isMergeSource ? (
                            <button
                              onClick={() => setMergingId(null)}
                              className="px-3 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 text-xs font-black hover:bg-stone-200 transition-colors"
                            >
                              cancel
                            </button>
                          ) : (
                            <>
                              {canSplit && (
                                <button
                                  onClick={() => splitApart(r.id)}
                                  aria-label={`split ${r.name} apart`}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                  title="split apart"
                                >
                                  ✂️
                                </button>
                              )}
                              <button
                                onClick={() => setMergingId(r.id)}
                                aria-label={`merge ${r.name} with someone`}
                                className="px-3 h-8 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-xs font-black hover:bg-emerald-500 hover:text-white transition-colors"
                                title="same as…"
                              >
                                merge
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {isMergeTarget && (
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider shrink-0">
                          tap to merge
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-stone-100">
          {step === "target" ? (
            <button
              onClick={goToMembers}
              disabled={
                loadingSplits ||
                preparing ||
                (targetMode === "new" && !newTripName.trim()) ||
                (targetMode === "existing" && !existingTripId)
              }
              className="w-full py-4 bg-stone-900 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:bg-stone-300 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {loadingSplits || preparing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>next: members →</>
              )}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:bg-stone-300 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {targetMode === "new"
                    ? "create trip & merge 🪄"
                    : "merge into trip 🪄"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
