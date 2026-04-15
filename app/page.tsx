"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { supabase } from "@/lib/supabase";
import { Expense } from "@/lib/types";
import CreateTripModal from "@/components/create-trip-modal";
import AboutModal from "@/components/about-modal";
import ProfileMenu from "@/components/profile-menu";
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
}

export default function Home() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAlertStore();
  const { user, trips, fetchTrips, isLoading } = useTripStore();
  const [currentTime] = useState(() => Date.now());

  // modal states
  const [isCreating, setIsCreating] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // view states
  const [viewMode, setViewMode] = useState<"trips" | "quick">("trips");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("newest");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [includeSettled, setIncludeSettled] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  const [quickSplits, setQuickSplits] = useState<Expense[]>([]);
  const [isLoadingQuick, setIsLoadingQuick] = useState(false);

  const sortOptions = [
    { value: "newest", label: "newest first", icon: "✨" },
    { value: "oldest", label: "oldest first", icon: "⏳" },
    { value: "a_z", label: "name (a to z)", icon: "🔤" },
    { value: "z_a", label: "name (z to a)", icon: "🔠" },
  ];

  const hasActiveFilters =
    showOnlyMine || includeSettled || sortBy !== "newest";

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  useEffect(() => {
    const fetchQuickSplits = async () => {
      if (!user) return;
      setIsLoadingQuick(true);
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .is("trip_id", null)
        .order("created_at", { ascending: false });

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
        }));
        setQuickSplits(mappedData);
      }
      setIsLoadingQuick(false);
    };

    if (viewMode === "quick") {
      fetchQuickSplits();
    }
  }, [user, viewMode]);

  // 🔥 the new delete handler for standalone receipts
  const handleDeleteQuickSplit = (
    id: string,
    title: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation(); // prevents the card from routing when you click the trash button
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
      "delete receipt? 🗑️",
      "yes, delete it",
    );
  };

  const processedTrips = trips
    .filter((t) => (includeSettled ? true : t.status !== "finished"))
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
    });

  const displayedTrips = processedTrips.slice(0, visibleCount);
  const hasMoreTrips = visibleCount < processedTrips.length;

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-48 font-sans selection:bg-emerald-200 selection:text-emerald-900 relative">
      <div className="w-full max-w-md relative">
        {/* 🔥 completely revamped dynamic header */}
        <div className="flex justify-between items-center mb-6 pt-4">
          <h1 className="text-4xl font-black tracking-tight text-stone-800 drop-shadow-sm capitalize">
            {viewMode} {viewMode === "trips" ? "🎒" : "🧾"}
          </h1>
          <button
            onClick={() => setIsInfoModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-stone-100 text-stone-400 hover:text-emerald-500 hover:border-emerald-200 transition-all shadow-sm active:scale-95"
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>

        {/* feed content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {viewMode === "quick" ? (
            /* 🔥 STANDALONE RECEIPTS TAB */
            isLoadingQuick ? (
              <div className="text-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm font-bold text-stone-400">
                  finding receipts...
                </p>
              </div>
            ) : quickSplits.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200 relative">
                <div className="text-5xl mb-4 inline-block">📸</div>
                <h3 className="text-lg font-extrabold text-stone-800 mb-1">
                  no quick splits
                </h3>
                <p className="text-sm font-bold text-stone-400 px-4">
                  snap a receipt directly from the + button. it lives here for 7
                  days!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {quickSplits.map((expense) => {
                  // 🔥 countdown math
                  const createdAt = new Date(expense.createdAt).getTime();
                  const daysSince = Math.floor(
                    (currentTime - createdAt) / (1000 * 60 * 60 * 24),
                  );
                  const daysLeft = Math.max(0, 7 - daysSince);

                  return (
                    <button
                      key={expense.id}
                      onClick={() =>
                        router.push(`/expense/${expense.id}?from=quick`)
                      }
                      className="w-full bg-white p-5 rounded-3xl shadow-sm border-2 border-stone-100 hover:shadow-md hover:border-emerald-200 transition-all text-left flex justify-between items-center group active:scale-[0.98]"
                    >
                      <div className="flex flex-col gap-2 pr-4 min-w-0 flex-1">
                        <h3 className="font-extrabold text-stone-800 text-lg truncate group-hover:text-emerald-700 transition-colors">
                          {expense.title}
                        </h3>
                        <div className="flex items-center flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                          <span className="text-stone-400">
                            {/* 🔥 formatted to match trip cards: APR 21, 2025 */}
                            {new Date(expense.expenseDate.replace(" ", "T"))
                              .toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                              .toUpperCase()}
                          </span>
                          <span className="text-stone-300">•</span>
                          <span
                            className={`px-2 py-0.5 rounded-md ${daysLeft <= 2 ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"}`}
                          >
                            ⏳ {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 🔥 new delete button */}
                        <div
                          onClick={(e) =>
                            handleDeleteQuickSplit(expense.id, expense.title, e)
                          }
                          className="shrink-0 w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 hover:bg-rose-500 hover:text-white transition-colors"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </div>
                        <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
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
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            /* 🔥 TRIPS TAB (ACTIVE & SETTLED) */
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
                          setVisibleCount(5);
                        }}
                        className="w-full pl-11 pr-4 py-4 text-sm font-bold border-2 border-stone-100 shadow-sm rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white text-stone-700 placeholder:text-stone-300"
                      />
                      <svg
                        className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
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
                      className={`shrink-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm relative active:scale-95 ${
                        isFilterOpen || hasActiveFilters
                          ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                          : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
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
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      {hasActiveFilters && (
                        <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-emerald-50"></div>
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
                              <div
                                className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${showOnlyMine ? "bg-emerald-500" : "bg-stone-200"}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${showOnlyMine ? "translate-x-5" : "translate-x-0"}`}
                                ></div>
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={showOnlyMine}
                                onChange={() => {
                                  setShowOnlyMine(!showOnlyMine);
                                  setVisibleCount(5);
                                }}
                              />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                              <span className="text-sm font-bold text-stone-600 group-hover:text-stone-800 transition-colors">
                                include settled
                              </span>
                              <div
                                className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 ${includeSettled ? "bg-emerald-500" : "bg-stone-200"}`}
                              >
                                <div
                                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${includeSettled ? "translate-x-5" : "translate-x-0"}`}
                                ></div>
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={includeSettled}
                                onChange={() => {
                                  setIncludeSettled(!includeSettled);
                                  setVisibleCount(5);
                                }}
                              />
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
                                  setVisibleCount(5);
                                }}
                                className={`flex items-center gap-3 w-full px-3 py-3 text-left text-[13px] font-black rounded-xl transition-colors ${sortBy === option.value ? "bg-emerald-50 text-emerald-700" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"}`}
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
                <div className="text-center py-20">
                  <div className="relative w-16 h-16 flex items-center justify-center mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xl animate-pulse">🐣</span>
                  </div>
                  <p className="text-sm text-stone-500 font-bold tracking-wide">
                    warming up the nest...
                  </p>
                </div>
              ) : processedTrips.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200 relative">
                  <div className="text-5xl mb-4 inline-block">🕊️</div>
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
                <div className="space-y-4">
                  {displayedTrips.map((trip) => (
                    <button
                      key={trip.id}
                      onClick={() => router.push(`/trip/${trip.id}`)}
                      className={`w-full bg-white p-5 sm:p-6 rounded-3xl shadow-sm border-2 transition-all text-left flex justify-between items-center group active:scale-[0.98] ${
                        trip.status === "finished"
                          ? "border-stone-100 opacity-60 hover:opacity-100"
                          : "border-stone-100 hover:shadow-md hover:border-emerald-200"
                      }`}
                    >
                      <div className="flex flex-col gap-2 pr-4 min-w-0">
                        <h3
                          className={`font-extrabold text-lg sm:text-xl truncate transition-colors ${
                            trip.status === "finished"
                              ? "text-stone-400 line-through decoration-stone-300 decoration-2"
                              : "text-stone-800 group-hover:text-emerald-700"
                          }`}
                        >
                          {trip.name}
                        </h3>
                        <div className="flex flex-col gap-1.5 text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">
                          <div className="flex items-center flex-wrap gap-2">
                            <span
                              className={`border px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                                trip.status === "finished"
                                  ? "bg-stone-50 border-stone-200 text-stone-400"
                                  : "bg-stone-50 border-stone-100 text-stone-500"
                              }`}
                            >
                              {trip.owner_id === user?.id
                                ? "you"
                                : trip.owner_name}{" "}
                              👑
                            </span>
                            {trip.members && trip.members.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="shrink-0">
                                  {trip.members.length}{" "}
                                  {trip.members.length === 1
                                    ? "member"
                                    : "members"}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span className="shrink-0">
                              {new Date(trip.createdAt)
                                .toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                                .toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors shadow-sm border ${
                          trip.status === "finished"
                            ? "bg-stone-50 border-stone-100 text-stone-300"
                            : "bg-stone-50 border-stone-100 text-stone-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:border-emerald-200 group-hover:-rotate-45"
                        }`}
                      >
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 12h14M12 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  ))}
                  {hasMoreTrips && (
                    <button
                      onClick={() => setVisibleCount((prev) => prev + 5)}
                      className="w-full mt-4 py-4 bg-stone-100 text-stone-500 font-black rounded-3xl hover:bg-stone-200 active:scale-95 transition-all text-sm border-2 border-stone-200/50 hover:border-stone-300 border-dashed"
                    >
                      load more trips ⬇️
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* modals */}
        <CreateTripModal
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
        />
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
        <ProfileMenu
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        {/* 🔥 NEW INFO MODAL */}
        {isInfoModalOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-70 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
              <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
                <h2 className="text-2xl font-black text-stone-800">
                  how nest works 🐣
                </h2>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold text-lg"
                >
                  ×
                </button>
              </div>
              <div className="p-6 space-y-4 bg-stone-50">
                <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm">
                  <div className="text-3xl mb-2">🎒</div>
                  <h3 className="font-extrabold text-lg text-stone-800">
                    trips
                  </h3>
                  <p className="text-sm font-bold text-stone-400 mt-1 leading-relaxed">
                    dedicated spaces for ongoing group expenses (holidays,
                    housemates). these are saved permanently until you settle
                    them.
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm">
                  <div className="text-3xl mb-2">🧾</div>
                  <h3 className="font-extrabold text-lg text-stone-800">
                    receipts
                  </h3>
                  <p className="text-sm font-bold text-stone-400 mt-1 leading-relaxed">
                    quick, standalone splits for single events (a shared
                    dinner). these self-destruct after 7 days to keep your
                    dashboard clean.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* action menu (intent modal) */}
        {isActionMenuOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end justify-center animate-in fade-in duration-300">
            <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-500 p-6 pt-8 pb-12 relative">
              <button
                onClick={() => setIsActionMenuOpen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold"
              >
                ×
              </button>
              <h2 className="text-2xl font-black text-stone-800 mb-2">
                what&apos;s the plan?
              </h2>
              <p className="text-sm font-bold text-stone-400 mb-8">
                create a group trip or split a quick receipt.
              </p>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    setIsCreating(true);
                  }}
                  className="w-full flex items-center gap-4 bg-white border-2 border-stone-100 p-4 rounded-2xl hover:border-emerald-200 hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] active:scale-95 transition-all text-left group"
                >
                  <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-500 text-2xl shadow-inner shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    🎒
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-stone-800 text-lg group-hover:text-emerald-700 transition-colors">
                      start a new trip
                    </span>
                    <span className="text-xs font-bold text-stone-400">
                      create a dedicated space for a group
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-0.5 w-full bg-stone-100 rounded-full"></div>
                  <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest shrink-0">
                    quick splits
                  </span>
                  <div className="h-0.5 w-full bg-stone-100 rounded-full"></div>
                </div>

                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    router.push("/quick-split?action=scan");
                  }}
                  className="w-full flex items-center gap-4 bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all text-left"
                >
                  <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-sm shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-400 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center font-black tracking-widest text-[8px] uppercase">
                      AI ✨
                    </div>
                    📸
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-emerald-800 text-lg">
                      scan receipt
                    </span>
                    <span className="text-xs font-bold text-emerald-600/80">
                      let gemini do the math instantly
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    router.push("/quick-split?action=manual");
                  }}
                  className="w-full flex items-center gap-4 bg-white border-2 border-stone-100 p-4 rounded-2xl hover:bg-stone-50 hover:border-stone-200 active:scale-95 transition-all text-left"
                >
                  <div className="w-14 h-14 bg-stone-50 border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 text-2xl shadow-sm shrink-0">
                    ✍️
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-stone-800 text-lg">
                      enter manually
                    </span>
                    <span className="text-xs font-bold text-stone-400">
                      type the items yourself
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* native bottom app bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-0 sm:pb-6 px-0 sm:px-4 pointer-events-none">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl h-20 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex items-center justify-between px-6 relative pointer-events-auto border-t sm:border border-stone-100">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setViewMode("trips")}
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 w-12 ${viewMode === "trips" ? "text-emerald-500 scale-105" : "text-stone-400 hover:text-stone-600"}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
              className={`flex flex-col items-center gap-1 transition-all active:scale-90 w-12 ${viewMode === "quick" ? "text-emerald-500 scale-105" : "text-stone-400 hover:text-stone-600"}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
                onClick={() => setIsActionMenuOpen(true)}
                className={`w-full h-full rounded-full border-4 border-white flex items-center justify-center text-white bg-emerald-500 transition-all duration-300 active:scale-90 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-600 ${isActionMenuOpen ? "rotate-45 bg-stone-800" : ""}`}
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              onClick={() => setIsAboutOpen(true)}
              className="flex flex-col items-center gap-1 transition-all active:scale-90 w-12 text-stone-400 hover:text-stone-600"
            >
              <svg
                className="w-6 h-6"
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
              <span className="text-[10px] font-black">about</span>
            </button>

            <button
              onClick={() => setIsProfileOpen(true)}
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
