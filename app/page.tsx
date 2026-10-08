"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { useUiStore } from "@/store/useUiStore";
import { supabase } from "@/lib/supabase";
import { Expense, Member } from "@/lib/types";
import MergeModal from "@/components/merge-modal";
import LoadingState from "@/components/loading-state";
import {
  LIST_PAGE_SIZE,
  ListFooter,
  ListSections,
  ReceiptRow,
  TripRow,
  groupByMonth,
} from "@/components/home-list";
import { getRetention } from "@/lib/retention";
import Image from "next/image";

type SortType = "newest" | "oldest" | "a_z" | "z_a";

interface QuickSplitRow {
  id: string;
  title: string;
  total_amount: number;
  paid_by: Record<string, number>;
  owed_by: Record<string, number>;
  split_type: "equal" | "exact" | "adjustment";
  expense_date: string;
  created_at: string;
  category: string;
  ephemeral_members?: Member[];
  is_kept?: boolean;
  retention_from?: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAlert = useAlertStore((s) => s.showAlert);
  const showConfirm = useAlertStore((s) => s.showConfirm);

  // the "＋ new" action menu, create-trip, about and profile modals now live
  // globally in <AppShell> (so the desktop sidebar can open them too); the
  // mobile bottom nav below drives them through this shared store.
  const openActionMenu = useUiStore((s) => s.openActionMenu);
  const isActionMenuOpen = useUiStore((s) => s.isActionMenuOpen);
  const openAbout = useUiStore((s) => s.openAbout);
  const openProfile = useUiStore((s) => s.openProfile);

  const user = useTripStore((s) => s.user);
  const profile = useTripStore((s) => s.profile);
  const trips = useTripStore((s) => s.trips);
  const fetchTrips = useTripStore((s) => s.fetchTrips);
  const isLoading = useTripStore((s) => s.isLoading);

  const [currentTime] = useState(() => Date.now());

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const urlMode = searchParams.get("tab") === "quick" ? "quick" : "trips";

  // the tab lives in the ui store so the desktop sidebar (which renders
  // outside this page) can set it directly, exactly like the bottom nav does.
  const viewMode = useUiStore((s) => s.homeView);
  const setHomeView = useUiStore((s) => s.setHomeView);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sortBy, setSortBy] = useState<SortType>(
    (searchParams.get("sort") as SortType) || "newest",
  );
  const [showOnlyMine, setShowOnlyMine] = useState(
    searchParams.get("mine") === "true",
  );
  const [showOnlyKept, setShowOnlyKept] = useState(
    searchParams.get("kept") === "true",
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");
    if (sortBy !== "newest") params.set("sort", sortBy);
    else params.delete("sort");
    if (showOnlyMine) params.set("mine", "true");
    else params.delete("mine");
    if (showOnlyKept) params.set("kept", "true");
    else params.delete("kept");

    const newQuery = params.toString();
    if (newQuery !== searchParams.toString()) {
      router.replace(`/?${newQuery}`, { scroll: false });
    }
  }, [searchQuery, sortBy, showOnlyMine, showOnlyKept, router, searchParams]);

  const setViewMode = (mode: "trips" | "quick") => {
    setHomeView(mode);

    const params = new URLSearchParams(searchParams.toString());
    if (mode === "quick") params.set("tab", "quick");
    else params.delete("tab");
    params.delete("q");

    const newQuery = params.toString();
    router.push(newQuery ? `/?${newQuery}` : "/");
  };

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  const loadMore = useCallback(
    () => setVisibleCount((prev) => prev + LIST_PAGE_SIZE),
    [],
  );

  // 🪄 merge mode: multi-select quick splits and fold them into a trip
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  // browser back/forward is the one case where the URL leads: adopt it.
  // on mount this is already a no-op — the store seeds itself from the
  // deep link — so it never looks like a switch and never wipes ?q=.
  useEffect(() => {
    setHomeView(urlMode);
  }, [urlMode, setHomeView]);

  // switching tabs resets the page-local view state. this hangs off viewMode
  // rather than living in setViewMode so that *both* navs get it — the
  // sidebar can't reach in here to call setViewMode.
  const [prevView, setPrevView] = useState(viewMode);
  if (viewMode !== prevView) {
    setPrevView(viewMode);
    setSearchQuery("");
    setVisibleCount(LIST_PAGE_SIZE);
    setIsSelecting(false);
    setSelectedIds(new Set());
  }

  const exitSelectMode = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [quickSplits, setQuickSplits] = useState<Expense[]>([]);
  const [isLoadingQuick, setIsLoadingQuick] = useState(false);

  const sortOptions = [
    { value: "newest", label: "newest first", icon: "✨" },
    { value: "oldest", label: "oldest first", icon: "⏳" },
    { value: "a_z", label: "name (a to z)", icon: "🔤" },
    { value: "z_a", label: "name (z to a)", icon: "🔠" },
  ];

  const hasActiveTripFilters =
    showOnlyMine || showOnlyKept || sortBy !== "newest";
  const hasActiveQuickFilters = sortBy !== "newest";

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // 🔥 L6 FIX: server-side ownership filter via the new created_by column.
  //
  // before: SELECT * WHERE trip_id IS NULL → returned every quick-split for
  // every user, then filtered client-side based on whether auth.uid() showed
  // up in paid_by/owed_by/ephemeral_members. that was both a privacy leak
  // (PII like display names in JSON, visible to all authenticated users) and
  // a hard scaling cap (kilobytes per row × every user × every page load).
  //
  // after: WHERE trip_id IS NULL AND created_by = auth.uid(). when RLS is
  // enabled later, this constraint becomes architectural too.
  //
  // keyed on the user's id, not the user object: supabase re-emits auth
  // events (e.g. on tab refocus) with a fresh object for the same person,
  // which used to refetch and flash the spinner every time.
  const userId = user?.id;
  useEffect(() => {
    let cancelled = false;
    const fetchQuickSplits = async () => {
      if (!userId) return;
      setIsLoadingQuick(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .is("trip_id", null)
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (data && !error) {
        const mappedData: Expense[] = (data as QuickSplitRow[]).map((exp) => ({
          id: exp.id,
          title: exp.title,
          totalAmount: exp.total_amount,
          paidBy: exp.paid_by || {},
          owedBy: exp.owed_by || {},
          splitType: exp.split_type || "equal",
          expenseDate: exp.expense_date || exp.created_at,
          createdAt: exp.created_at,
          category: exp.category || "other",
          isKept: exp.is_kept ?? false,
          retentionFrom: exp.retention_from || exp.created_at,
        }));
        setQuickSplits(mappedData);
      }
      setIsLoadingQuick(false);
    };

    if (viewMode === "quick") {
      fetchQuickSplits();
    }
    return () => {
      cancelled = true;
    };
  }, [userId, viewMode]);

  // 🔥 U5 follow-through: severity is now explicit, not inferred from title.
  const handleDeleteQuickSplit = (
    id: string,
    title: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    showConfirm(
      `are you sure you want to delete "${title}"?`,
      async () => {
        const { error } = await supabase.from("expenses").delete().eq("id", id);
        if (!error) {
          setQuickSplits((prev) => prev.filter((exp) => exp.id !== id));
        } else {
          showAlert("failed to delete the receipt.", "error ❌");
        }
      },
      {
        title: "delete receipt? 🗑️",
        confirmText: "yes, delete it",
        severity: "destructive",
      },
    );
  };

  // 🔥 L11 FIX: memoize the filter+sort pipeline. previously these recomputed
  // on every render (e.g. every keystroke in unrelated inputs would re-sort
  // the entire trip list). negligible at 5-10 trips, real at scale, and the
  // hook is free.
  const processedTrips = useMemo(
    () =>
      trips
        .filter((t) => (showOnlyKept ? t.is_kept : true))
        .filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .filter((t) => (showOnlyMine ? t.owner_id === user?.id : true))
        .sort((a, b) => {
          if (sortBy === "newest")
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          if (sortBy === "oldest")
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          if (sortBy === "a_z") return a.name.localeCompare(b.name);
          if (sortBy === "z_a") return b.name.localeCompare(a.name);
          return 0;
        }),
    [trips, showOnlyKept, searchQuery, showOnlyMine, sortBy, user?.id],
  );

  const displayedTrips = useMemo(
    () => processedTrips.slice(0, visibleCount),
    [processedTrips, visibleCount],
  );
  const hasMoreTrips = visibleCount < processedTrips.length;

  const processedQuickSplits = useMemo(
    () =>
      quickSplits
        .filter((exp) =>
          exp.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .sort((a, b) => {
          if (sortBy === "newest")
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          if (sortBy === "oldest")
            return (
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          if (sortBy === "a_z") return a.title.localeCompare(b.title);
          if (sortBy === "z_a") return b.title.localeCompare(a.title);
          return 0;
        }),
    [quickSplits, searchQuery, sortBy],
  );

  const displayedQuickSplits = useMemo(
    () => processedQuickSplits.slice(0, visibleCount),
    [processedQuickSplits, visibleCount],
  );
  const hasMoreQuick = visibleCount < processedQuickSplits.length;

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName =
    profile?.nickname ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <main
      className={`flex min-h-screen flex-col items-center p-6 lg:p-10 bg-[#fdfbf7] pb-48 ${isSelecting ? "lg:pb-32" : "lg:pb-12"} font-sans selection:bg-emerald-200 selection:text-emerald-900 relative`}
    >
      <div className="w-full max-w-md lg:max-w-5xl relative">
        <div className="flex justify-between items-center mb-6 pt-4">
          <h1 className="text-4xl font-black tracking-tight text-stone-800 drop-shadow-sm">
            {viewMode === "trips" ? "trips 🎒" : "receipts 🧾"}
          </h1>
          <div className="flex items-center gap-2">
            {viewMode === "quick" &&
              !isLoadingQuick &&
              quickSplits.length > 0 &&
              !isSelecting && (
                <button
                  onClick={() => setIsSelecting(true)}
                  aria-label="merge receipts"
                  title="merge receipts"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-stone-100 text-stone-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm active:scale-95"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="18" cy="18" r="2.5" strokeWidth={2} />
                    <circle cx="6" cy="6" r="2.5" strokeWidth={2} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 21V9a9 9 0 009 9"
                    />
                  </svg>
                </button>
              )}
            <button
              onClick={() => setIsInfoModalOpen(true)}
              aria-label="how nest works"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-stone-100 text-stone-400 hover:text-emerald-500 hover:border-emerald-200 transition-all shadow-sm active:scale-95"
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
                strokeWidth={3}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {viewMode === "quick" ? (
            <>
              {!isLoadingQuick && quickSplits.length > 0 && (
                <div className="flex flex-col gap-3 mb-6 relative z-30">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="search receipts..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setVisibleCount(LIST_PAGE_SIZE);
                        }}
                        aria-label="search receipts"
                        className="w-full pl-11 pr-4 py-4 text-sm font-bold border-2 border-stone-100 shadow-sm rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white text-stone-700 placeholder:text-stone-300"
                      />
                      <svg
                        className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      aria-label="filter and sort"
                      aria-expanded={isFilterOpen}
                      className={`shrink-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm relative active:scale-95 ${
                        isFilterOpen || hasActiveQuickFilters
                          ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                          : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                      }`}
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
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      {hasActiveQuickFilters && (
                        <div
                          className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-emerald-50"
                          aria-hidden="true"
                        ></div>
                      )}
                    </button>

                    {isFilterOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsFilterOpen(false)}
                        ></div>
                        <div className="absolute top-[calc(100%+8px)] right-0 w-60 bg-white border-2 border-stone-100 rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2 flex flex-col">
                            <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-3 pt-3 pb-2">
                              sort by
                            </span>
                            {sortOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSortBy(option.value as SortType);
                                  setIsFilterOpen(false);
                                  setVisibleCount(LIST_PAGE_SIZE);
                                }}
                                className={`flex items-center gap-3 w-full px-3 py-3 text-left text-[13px] font-black rounded-xl transition-colors ${
                                  sortBy === option.value
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                                }`}
                              >
                                <span className="text-base">{option.icon}</span>
                                <span className="flex-1">{option.label}</span>
                                {sortBy === option.value && (
                                  <span className="text-emerald-500 text-lg leading-none">
                                    ✓
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!isLoadingQuick && quickSplits.length > 0 && isSelecting && (
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                    <button
                      onClick={exitSelectMode}
                      className="text-xs font-black text-stone-500 hover:text-stone-800 uppercase tracking-wider transition-colors"
                    >
                      cancel
                    </button>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-emerald-700 tabular-nums">
                        {selectedIds.size} selected
                      </span>
                      <span className="text-emerald-300" aria-hidden="true">
                        •
                      </span>
                      <button
                        onClick={() => {
                          const allIds = processedQuickSplits.map((e) => e.id);
                          const allSelected = allIds.every((id) =>
                            selectedIds.has(id),
                          );
                          setSelectedIds(
                            allSelected ? new Set() : new Set(allIds),
                          );
                        }}
                        className="text-xs font-black text-emerald-600 hover:text-emerald-800 uppercase tracking-wider transition-colors"
                      >
                        {processedQuickSplits.every((e) =>
                          selectedIds.has(e.id),
                        )
                          ? "clear all"
                          : "select all"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingQuick ? (
                <div className="py-20">
                  <LoadingState label="finding receipts..." />
                </div>
              ) : processedQuickSplits.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200 relative">
                  <div
                    className="text-5xl mb-4 inline-block"
                    aria-hidden="true"
                  >
                    📸
                  </div>
                  <h3 className="text-lg font-extrabold text-stone-800 mb-1">
                    {searchQuery ? "no receipts found" : "no quick splits"}
                  </h3>
                  <p className="text-sm font-bold text-stone-400 px-4">
                    {searchQuery
                      ? "try a different name."
                      : "snap a receipt directly from the + button. it auto-deletes after 7 days unless you keep it 📌"}
                  </p>
                </div>
              ) : (
                <>
                  <ListSections
                    sections={groupByMonth(
                      displayedQuickSplits,
                      (e) => e.createdAt,
                      sortBy === "newest" || sortBy === "oldest",
                    )}
                    getKey={(e) => e.id}
                    renderItem={(expense) => (
                      <ReceiptRow
                        expense={expense}
                        retention={getRetention(
                          expense.retentionFrom || expense.createdAt,
                          currentTime,
                        )}
                        isSelecting={isSelecting}
                        isSelected={selectedIds.has(expense.id)}
                        onOpen={() =>
                          isSelecting
                            ? toggleSelected(expense.id)
                            : router.push(`/expense/${expense.id}?from=quick`)
                        }
                        onDelete={(e) =>
                          handleDeleteQuickSplit(expense.id, expense.title, e)
                        }
                      />
                    )}
                  />
                  <ListFooter
                    hasMore={hasMoreQuick}
                    onLoadMore={loadMore}
                    shown={displayedQuickSplits.length}
                    total={processedQuickSplits.length}
                    noun="receipt"
                  />
                </>
              )}
            </>
          ) : (
            <>
              {!isLoading && trips.length > 0 && (
                <div className="flex flex-col gap-3 mb-6 relative z-30">
                  <div className="flex items-center gap-2 relative">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="search trips..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setVisibleCount(LIST_PAGE_SIZE);
                        }}
                        aria-label="search trips"
                        className="w-full pl-11 pr-4 py-4 text-sm font-bold border-2 border-stone-100 shadow-sm rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white text-stone-700 placeholder:text-stone-300"
                      />
                      <svg
                        className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      aria-label="filter and sort"
                      aria-expanded={isFilterOpen}
                      className={`shrink-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm relative active:scale-95 ${
                        isFilterOpen || hasActiveTripFilters
                          ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                          : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                      }`}
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
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      {hasActiveTripFilters && (
                        <div
                          className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-emerald-50"
                          aria-hidden="true"
                        ></div>
                      )}
                    </button>

                    {isFilterOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsFilterOpen(false)}
                        ></div>
                        <div className="absolute top-[calc(100%+8px)] right-0 w-60 bg-white border-2 border-stone-100 rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-5 border-b-2 border-stone-50 flex flex-col gap-4">
                            <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest">
                              view options
                            </span>

                            <label className="flex items-center justify-between cursor-pointer group">
                              <span className="text-sm font-bold text-stone-600 group-hover:text-stone-800 transition-colors">
                                created by me
                              </span>
                              <input
                                type="checkbox"
                                role="switch"
                                checked={showOnlyMine}
                                aria-checked={showOnlyMine}
                                onChange={() => {
                                  setShowOnlyMine(!showOnlyMine);
                                  setVisibleCount(LIST_PAGE_SIZE);
                                }}
                                className="sr-only peer"
                              />
                              <div
                                className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${showOnlyMine ? "bg-emerald-500" : "bg-stone-200"}`}
                                aria-hidden="true"
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${showOnlyMine ? "translate-x-5" : "translate-x-0"}`}
                                ></div>
                              </div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                              <span className="text-sm font-bold text-stone-600 group-hover:text-stone-800 transition-colors">
                                kept only 📌
                              </span>
                              <input
                                type="checkbox"
                                role="switch"
                                checked={showOnlyKept}
                                aria-checked={showOnlyKept}
                                onChange={() => {
                                  setShowOnlyKept(!showOnlyKept);
                                  setVisibleCount(LIST_PAGE_SIZE);
                                }}
                                className="sr-only peer"
                              />
                              <div
                                className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${showOnlyKept ? "bg-emerald-500" : "bg-stone-200"}`}
                                aria-hidden="true"
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${showOnlyKept ? "translate-x-5" : "translate-x-0"}`}
                                ></div>
                              </div>
                            </label>
                          </div>

                          <div className="p-2 flex flex-col">
                            <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-3 pt-3 pb-2">
                              sort by
                            </span>
                            {sortOptions.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSortBy(option.value as SortType);
                                  setIsFilterOpen(false);
                                  setVisibleCount(LIST_PAGE_SIZE);
                                }}
                                className={`flex items-center gap-3 w-full px-3 py-3 text-left text-[13px] font-black rounded-xl transition-colors ${
                                  sortBy === option.value
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                                }`}
                              >
                                <span className="text-base">{option.icon}</span>
                                <span className="flex-1">{option.label}</span>
                                {sortBy === option.value && (
                                  <span className="text-emerald-500 text-lg leading-none">
                                    ✓
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isLoading && trips.length === 0 ? (
                <div className="py-20">
                  <LoadingState />
                </div>
              ) : processedTrips.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200 relative">
                  <div
                    className="text-5xl mb-4 inline-block"
                    aria-hidden="true"
                  >
                    🕊️
                  </div>
                  <h3 className="text-lg font-extrabold text-stone-800 mb-1">
                    {searchQuery ? "no trips found" : "clean slate!"}
                  </h3>
                  <p className="text-sm font-bold text-stone-400">
                    {searchQuery
                      ? "try a different name."
                      : "where are we heading next?"}
                  </p>
                </div>
              ) : (
                <>
                  <ListSections
                    sections={groupByMonth(
                      displayedTrips,
                      (t) => t.createdAt,
                      sortBy === "newest" || sortBy === "oldest",
                    )}
                    getKey={(t) => t.id}
                    renderItem={(trip) => (
                      <TripRow
                        trip={trip}
                        isOwner={trip.owner_id === user?.id}
                        retention={getRetention(
                          trip.updatedAt || trip.createdAt,
                          currentTime,
                        )}
                        onOpen={() => router.push(`/trip/${trip.id}`)}
                      />
                    )}
                  />
                  <ListFooter
                    hasMore={hasMoreTrips}
                    onLoadMore={loadMore}
                    shown={displayedTrips.length}
                    total={processedTrips.length}
                    noun="trip"
                  />
                </>
              )}
            </>
          )}
        </div>

        <MergeModal
          isOpen={isMergeOpen}
          onClose={() => {
            setIsMergeOpen(false);
            exitSelectMode();
          }}
          selectedIds={Array.from(selectedIds)}
        />

        {isInfoModalOpen && (
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-70 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-nest-works-title"
            onClick={() => setIsInfoModalOpen(false)}
          >
            <div
              className="bg-[#fdfbf7] w-full max-w-md max-h-[90dvh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* header stays pinned; only the body scrolls, so the title and
                  close button can never be pushed off a short screen */}
              <div className="shrink-0 px-6 py-5 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
                <h2
                  id="how-nest-works-title"
                  className="text-2xl font-black text-stone-800"
                >
                  how nest works 🐣
                </h2>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  aria-label="close"
                  className="shrink-0 w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold text-lg"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 bg-stone-50 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                {[
                  {
                    icon: "🎒",
                    title: "trips",
                    body: (
                      <>
                        dedicated spaces for ongoing group expenses (holidays,
                        housemates). tap &quot;mark paid&quot; on a share once
                        someone pays you back.
                      </>
                    ),
                  },
                  {
                    icon: "🧾",
                    title: "receipts",
                    body: (
                      <>
                        quick, standalone splits for single events (a shared
                        dinner). merge a few into a trip anytime.
                      </>
                    ),
                  },
                  {
                    icon: "📌",
                    title: "keeping",
                    highlight: true,
                    body: (
                      <>
                        to keep things tidy, anything you don&apos;t keep
                        auto-deletes after 7 days — trips count from their last
                        activity, receipts from when they were made. tap{" "}
                        <span className="text-emerald-600">
                          keep forever 📌
                        </span>{" "}
                        to save one. only the trip owner or the receipt&apos;s
                        creator can keep it. stop keeping anytime and it gets a
                        fresh 7 days. merged receipts follow their trip&apos;s
                        rule.
                      </>
                    ),
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className={`bg-white p-4 rounded-3xl border-2 shadow-sm flex gap-3.5 ${card.highlight ? "border-emerald-100" : "border-stone-100"}`}
                  >
                    <div
                      className="shrink-0 w-11 h-11 rounded-2xl bg-stone-50 flex items-center justify-center text-xl"
                      aria-hidden="true"
                    >
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-stone-800">
                        {card.title}
                      </h3>
                      <p className="text-[13px] font-bold text-stone-400 mt-0.5 leading-relaxed">
                        {card.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* selection action bar — docks at the bottom of the content while
          selecting. on mobile it takes the bottom nav's place (the nav hides
          below); on desktop it offsets past the sidebar to align with content. */}
      {viewMode === "quick" && isSelecting && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-60 border-t border-stone-200/70 bg-white/95 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-300">
          <div className="mx-auto w-full max-w-md lg:max-w-2xl">
            <button
              onClick={() => setIsMergeOpen(true)}
              disabled={selectedIds.size === 0}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-lg active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none flex justify-center items-center gap-2"
            >
              <span aria-hidden="true">🪄</span>
              {selectedIds.size === 0
                ? "select receipts to merge"
                : `merge ${selectedIds.size} receipt${selectedIds.size !== 1 ? "s" : ""} into a trip`}
            </button>
          </div>
        </div>
      )}

      <div
        className={`${isSelecting ? "hidden" : "lg:hidden"} fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-0 sm:pb-6 px-0 sm:px-4 pointer-events-none`}
      >
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl h-[calc(5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex items-center justify-between px-6 relative pointer-events-auto border-t sm:border border-stone-100">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setViewMode("trips")}
              aria-label="view trips"
              aria-pressed={viewMode === "trips"}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 w-12 ${viewMode === "trips" ? "text-emerald-500 scale-105" : "text-stone-400 hover:text-stone-600"}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <span className="text-[10px] font-black">trips</span>
            </button>

            <button
              onClick={() => setViewMode("quick")}
              aria-label="view receipts"
              aria-pressed={viewMode === "quick"}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 w-12 ${viewMode === "quick" ? "text-emerald-500 scale-105" : "text-stone-400 hover:text-stone-600"}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-[10px] font-black">receipts</span>
            </button>
          </div>

          <div className="absolute left-1/2 -top-8 -translate-x-1/2 flex justify-center">
            <div className="w-24 h-24 bg-[#fdfbf7] rounded-full p-2 flex items-center justify-center">
              <button
                onClick={openActionMenu}
                aria-label="add new"
                className={`w-full h-full rounded-full border-4 border-white flex items-center justify-center text-white bg-emerald-500 transition-all duration-300 active:scale-90 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-600 ${isActionMenuOpen ? "rotate-45 bg-stone-800" : ""}`}
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={openAbout}
              aria-label="about nest"
              className="flex flex-col items-center gap-1 transition-all active:scale-90 w-12 text-stone-400 hover:text-stone-600"
            >
              <svg
                className="w-6 h-6"
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
              <span className="text-[10px] font-black">about</span>
            </button>

            <button
              onClick={openProfile}
              aria-label="profile"
              className="flex flex-col items-center gap-1 transition-all active:scale-90 w-12 text-stone-400 hover:text-stone-600 group"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden transition-all bg-stone-200 flex items-center justify-center shrink-0 group-hover:opacity-80">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    width={24}
                    height={24}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-black text-stone-500 group-hover:text-stone-600 transition-colors">
                    {initial}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black">profile</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdfbf7]">
          <LoadingState size="md" label={null} />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
