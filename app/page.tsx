"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { v4 as uuidv4 } from "uuid";
import ProfileMenu from "@/components/profile-menu";
import packageJson from "../package.json";

export default function Home() {
  const router = useRouter();
  const showAlert = useAlertStore((state) => state.showAlert);
  const { user, trips, addTrip, fetchTrips, isLoading } = useTripStore();

  const [newTripName, setNewTripName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<"ongoing" | "finished">("ongoing");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "a_z" | "z_a">(
    "newest",
  );
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [visibleCount, setVisibleCount] = useState(5);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const sortOptions = [
    { value: "newest", label: "newest first", icon: "✨" },
    { value: "oldest", label: "oldest first", icon: "⏳" },
    { value: "a_z", label: "name (a to z)", icon: "🔤" },
    { value: "z_a", label: "name (z to a)", icon: "🔠" },
  ];

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    setIsSubmitting(true);

    const newTripId = uuidv4();
    const newTrip = {
      id: newTripId,
      name: newTripName.trim(),
      date: new Date().toISOString().split("T")[0],
      currency: "IDR",
      members: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      status: "ongoing",
    };

    await addTrip(newTrip);
    setNewTripName("");
    setIsCreating(false);

    router.push(`/trip/${newTripId}`);
  };

  const processedTrips = trips
    .filter((t) =>
      viewMode === "finished"
        ? t.status === "finished"
        : t.status !== "finished",
    )
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

  // NEW: Slice the array for pagination
  const displayedTrips = processedTrips.slice(0, visibleCount);
  const hasMoreTrips = visibleCount < processedTrips.length;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-32 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* cozy header */}
        <div className="flex justify-between items-start mb-8 pt-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black tracking-tight text-emerald-800 drop-shadow-sm">
                nest.
              </h1>
              <button
                onClick={() =>
                  showAlert(
                    "welcome to nest! 🌿 use this to track group expenses for trips, house bills, or even just a shared dinner. we do the math so you can stay friends.",
                    "what is nest? 🐣",
                  )
                }
                className="w-5 h-5 mt-1 rounded-full text-stone-300 hover:text-stone-500 hover:bg-stone-100 flex items-center justify-center transition-all focus:outline-none"
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
                    strokeWidth={3}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
            <p className="text-sm text-stone-500 font-bold tracking-wide">
              split expenses, keep the peace 🌱
            </p>
          </div>
          <ProfileMenu />
        </div>

        {/* trips list with animated toggle, search, and sort */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* animated pill toggle replacing the old borders */}
          <div className="bg-stone-100 p-1.5 rounded-3xl flex gap-1 relative overflow-hidden mb-6">
            <div
              className={`absolute top-1.5 bottom-1.5 w-[49%] bg-white rounded-2xl shadow-sm transition-all duration-300 ease-out ${
                viewMode === "ongoing" ? "left-[1%]" : "left-[50%]"
              }`}
            ></div>
            <button
              onClick={() => {
                setViewMode("ongoing");
                setVisibleCount(5);
              }}
              className={`flex-1 py-3 text-sm z-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                viewMode === "ongoing"
                  ? "font-black text-stone-800"
                  : "font-bold text-stone-500 hover:text-stone-700"
              }`}
            >
              ongoing
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  showAlert(
                    "trips with active spending that haven't been fully paid back yet.",
                    "ongoing trips 🏃‍♂️",
                  );
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-stone-300 hover:bg-stone-200 hover:text-stone-500 transition-colors"
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
                    strokeWidth={3}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </button>
            <button
              onClick={() => {
                setViewMode("finished");
                setVisibleCount(5);
              }}
              className={`flex-1 py-3 text-sm z-10 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                viewMode === "finished"
                  ? "font-black text-stone-800"
                  : "font-bold text-stone-500 hover:text-stone-700"
              }`}
            >
              settled up 🤝
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  showAlert(
                    "trips where everyone has paid their debts and the trip is closed.",
                    "settled trips 🤝",
                  );
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center text-stone-300 hover:bg-stone-200 hover:text-stone-500 transition-colors"
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
                    strokeWidth={3}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </button>
          </div>

          {/* chunky search and sort ui */}
          {!isLoading && trips.length > 0 && (
            <div className="flex flex-col gap-3 mb-8">
              {/* Row 1: Full-width search */}
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="search trips..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleCount(5);
                  }}
                  className="w-full pl-12 pr-4 py-4 text-sm font-bold border-2 border-stone-100 shadow-sm rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white text-stone-700 placeholder:text-stone-300"
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

              {/* Row 2: Symmetrical Grid for Filter & Sort */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowOnlyMine(!showOnlyMine);
                    setVisibleCount(5);
                  }}
                  className={`flex items-center justify-center gap-2 w-full h-full min-h-13 rounded-2xl text-[11px] sm:text-[13px] font-black transition-all border-2 active:scale-95 shadow-sm ${
                    showOnlyMine
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-white text-stone-500 border-stone-100 hover:border-stone-200 hover:text-stone-700"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300 ${
                      showOnlyMine
                        ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                        : "bg-stone-200"
                    }`}
                  ></div>
                  created by me
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      showAlert(
                        "only show trips where you are the owner.",
                        "created by me 👑",
                      );
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${showOnlyMine ? "text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600" : "text-stone-300 hover:bg-stone-100 hover:text-stone-500"}`}
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
                  </div>
                </button>

                <div className="relative w-full h-full">
                  <button
                    onClick={() => setIsSortOpen(!isSortOpen)}
                    className={`flex items-center justify-center gap-2 w-full h-full min-h-13 rounded-2xl text-[11px] sm:text-[13px] font-black transition-all border-2 active:scale-95 shadow-sm bg-white ${
                      isSortOpen
                        ? "border-emerald-400 text-stone-800 ring-4 ring-emerald-100"
                        : "border-stone-100 text-stone-500 hover:border-stone-200 hover:text-stone-700"
                    }`}
                  >
                    <span className="opacity-80 text-sm">
                      {sortOptions.find((o) => o.value === sortBy)?.icon}
                    </span>
                    <span>
                      {sortOptions.find((o) => o.value === sortBy)?.label}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-300 ${isSortOpen ? "rotate-180 text-emerald-500" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {isSortOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsSortOpen(false)}
                      ></div>
                      <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border-2 border-stone-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(
                                option.value as
                                  | "newest"
                                  | "oldest"
                                  | "a_z"
                                  | "z_a",
                              );
                              setIsSortOpen(false);
                              setVisibleCount(5);
                            }}
                            className={`flex items-center gap-3 w-full px-4 py-3.5 text-left text-[11px] sm:text-[13px] font-black transition-colors ${
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
                    </>
                  )}
                </div>
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
                  : viewMode === "ongoing"
                    ? "where are we heading next?"
                    : "no settled trips yet."}
              </p>
              {!searchQuery && viewMode === "ongoing" && trips.length === 0 && (
                <div className="absolute -bottom-8 right-6 text-emerald-400 animate-bounce">
                  <svg
                    className="w-10 h-10 rotate-120 drop-shadow-sm"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* USE DISPLAYED TRIPS HERE INSTEAD OF PROCESSED TRIPS */}
              {displayedTrips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="w-full bg-white p-5 sm:p-6 rounded-3xl shadow-sm border-2 border-stone-100 hover:shadow-md hover:border-emerald-200 transition-all text-left flex justify-between items-center group active:scale-[0.98]"
                >
                  <div className="flex flex-col gap-2 pr-4 min-w-0">
                    <h3 className="font-extrabold text-stone-800 text-lg sm:text-xl truncate group-hover:text-emerald-700 transition-colors">
                      {trip.name}
                    </h3>
                    <div className="flex flex-col gap-1.5 text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="bg-stone-50 border border-stone-100 text-stone-500 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          {trip.owner_id === user?.id ? "you" : trip.owner_name}{" "}
                          👑
                        </span>

                        {trip.members && trip.members.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="shrink-0">
                              {trip.members.length}{" "}
                              {trip.members.length === 1 ? "member" : "members"}
                            </span>
                          </>
                        )}
                      </div>

                      <span className="text-stone-400/80">
                        created at{" "}
                        {new Date(trip.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors shadow-sm border border-stone-100 group-hover:border-emerald-200 group-hover:-rotate-45">
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

              {/* NEW: Load More Button */}
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
        </div>

        {/* NEW: Cozy Footer that opens About Modal */}
        {trips.length > 0 && (
          <div className="mt-12 mb-8 text-center animate-in fade-in duration-1000 delay-300 pb-16">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="text-[10px] font-black text-stone-400 uppercase tracking-widest hover:text-emerald-500 transition-colors active:scale-95 flex items-center justify-center gap-1.5 mx-auto bg-white/50 px-4 py-2 rounded-full border border-stone-100"
            >
              about?
            </button>
          </div>
        )}

        {/* sleek modern floating action pill */}
        {!isCreating && (
          <div className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 z-40 animate-in slide-in-from-bottom-8 duration-500">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-3 pl-6 pr-2 py-2 bg-stone-900 text-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:bg-emerald-600 active:scale-95 transition-all duration-300 group"
            >
              <span className="text-xs font-black tracking-widest uppercase">
                new trip
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

        {/* bottom sheet style form overlay */}
        {isCreating && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"></div>

              <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
                <h2 className="text-2xl font-black text-stone-800">
                  start a trip 🚀
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg"
                >
                  ×
                </button>
              </div>

              <div className="p-6 pt-8">
                <form
                  onSubmit={handleCreateTrip}
                  className="flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                      trip name
                    </label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. weekend in bali 🌴"
                      value={newTripName}
                      onChange={(e) => setNewTripName(e.target.value)}
                      className="w-full bg-white border-2 border-stone-100 shadow-sm rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 text-stone-800 placeholder:text-stone-300 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newTripName.trim()}
                    className="w-full py-4 bg-stone-900 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/20 hover:shadow-emerald-600/30 active:scale-95 disabled:bg-stone-300 disabled:shadow-none flex justify-center items-center mt-2"
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      "create trip ✨"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* NEW: about the creator bottom sheet */}
        {isAboutOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
              {/* handle */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden z-20"></div>

              {/* close button */}
              <div className="px-6 py-5 pt-8 sm:pt-6 flex justify-end items-center absolute top-0 right-0 w-full z-20">
                <button
                  type="button"
                  onClick={() => setIsAboutOpen(false)}
                  className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg shadow-sm"
                >
                  ×
                </button>
              </div>

              {/* playful header background */}
              <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-emerald-100/50 to-transparent z-0"></div>

              <div className="p-8 pt-12 flex flex-col items-center text-center relative z-10">
                {/* bouncy avatar cluster */}
                <div className="relative mb-5 group cursor-pointer mt-4">
                  <div className="absolute inset-0 bg-emerald-300 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>

                  {/* main avatar container */}
                  <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center relative z-10 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
                    {/* 👇 THIS IS THE NEW INITIALS FH ICON 👇 */}
                    <span className="font-black text-emerald-900 tracking-tighter text-4xl lowercase select-none">
                      fh
                    </span>
                  </div>

                  {/* keep the decorative floating emojis for that playful touch */}
                  <div className="absolute -bottom-1 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] z-20 shadow-sm animate-bounce drop-shadow-md">
                    ✨
                  </div>
                  <div className="absolute -top-1 -left-2 w-6 h-6 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] z-20 shadow-sm animate-[bounce_2s_infinite_100ms] drop-shadow-md">
                    ⚡
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 mb-8">
                  <h2 className="text-2xl font-black text-stone-800 tracking-tight">
                    fernando halim
                  </h2>
                  <p className="text-sm font-bold text-emerald-600">
                    indie maker & developer 🚀
                  </p>
                </div>

                {/* links grid - colorful & bouncy */}
                <div className="w-full flex flex-col gap-3">
                  {/* 1. Portfolio */}
                  <a
                    href="https://fernando-halim.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full relative overflow-hidden flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-emerald-300 hover:shadow-md transition-all active:scale-[0.98] group"
                  >
                    <div className="absolute inset-0 w-0 bg-emerald-50 transition-all duration-300 ease-out group-hover:w-full"></div>
                    <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm relative z-10">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-base group-hover:scale-110 group-hover:rotate-12 transition-transform">
                        🌍
                      </div>
                      check out my porto website
                    </div>
                    <svg
                      className="w-4 h-4 text-stone-300 group-hover:text-emerald-500 transition-colors relative z-10 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>

                  {/* 2. Email */}
                  <a
                    href="mailto:fernandohalim26@gmail.com"
                    className="w-full relative overflow-hidden flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-amber-300 hover:shadow-md transition-all active:scale-[0.98] group"
                  >
                    <div className="absolute inset-0 w-0 bg-amber-50 transition-all duration-300 ease-out group-hover:w-full"></div>
                    <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm relative z-10">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-base group-hover:scale-110 group-hover:-rotate-12 transition-transform">
                        💌
                      </div>
                      say hello via email
                    </div>
                    <svg
                      className="w-4 h-4 text-stone-300 group-hover:text-amber-500 transition-colors relative z-10 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>

                  {/* 3. GitHub */}
                  <a
                    href="https://github.com/fernandohalim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full relative overflow-hidden flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-stone-400 hover:shadow-md transition-all active:scale-[0.98] group"
                  >
                    <div className="absolute inset-0 w-0 bg-stone-100 transition-all duration-300 ease-out group-hover:w-full"></div>
                    <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm relative z-10">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-base group-hover:scale-110 group-hover:rotate-12 transition-transform">
                        🐙
                      </div>
                      follow me on github
                    </div>
                    <svg
                      className="w-4 h-4 text-stone-300 group-hover:text-stone-600 transition-colors relative z-10 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>

                  {/* 4. LinkedIn */}
                  <a
                    href="https://linkedin.com/in/fernandohalim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full relative overflow-hidden flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98] group"
                  >
                    <div className="absolute inset-0 w-0 bg-blue-50 transition-all duration-300 ease-out group-hover:w-full"></div>
                    <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm relative z-10">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-base group-hover:scale-110 group-hover:-rotate-12 transition-transform">
                        💼
                      </div>
                      connect on linkedin
                    </div>
                    <svg
                      className="w-4 h-4 text-stone-300 group-hover:text-blue-500 transition-colors relative z-10 group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </a>

                  {/* 5. Repo Link (Subtle) */}
                  <a
                    href="https://github.com/fernandohalim/nest-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-[11px] font-black text-stone-400 uppercase tracking-widest hover:text-emerald-500 transition-colors flex items-center justify-center gap-1.5"
                  >
                    view nest source code 🐣
                  </a>
                </div>

                <div className="mt-8 text-[10px] font-black text-stone-300 uppercase tracking-widest border-t-2 border-dashed border-stone-100 pt-6 w-full">
                  nest v{packageJson.version} • keeping the peace
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
