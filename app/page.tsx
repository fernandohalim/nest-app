"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { v4 as uuidv4 } from "uuid";
import ProfileMenu from "@/components/profile-menu";
import CustomSelect from "@/components/custom-select";

export default function Home() {
  const router = useRouter();

  const { trips, addTrip, fetchTrips, isLoading } = useTripStore();

  const [newTripName, setNewTripName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<"ongoing" | "finished">("ongoing");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "a_z" | "z_a">(
    "newest",
  );

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

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-32 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        {/* cozy header */}
        <div className="flex justify-between items-start mb-8 pt-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-emerald-800 drop-shadow-sm">
              nest.
            </h1>
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
              onClick={() => setViewMode("ongoing")}
              className={`flex-1 py-3 text-sm z-10 rounded-2xl transition-all active:scale-95 ${
                viewMode === "ongoing"
                  ? "font-black text-stone-800"
                  : "font-bold text-stone-500 hover:text-stone-700"
              }`}
            >
              ongoing
            </button>
            <button
              onClick={() => setViewMode("finished")}
              className={`flex-1 py-3 text-sm z-10 rounded-2xl transition-all active:scale-95 ${
                viewMode === "finished"
                  ? "font-black text-stone-800"
                  : "font-bold text-stone-500 hover:text-stone-700"
              }`}
            >
              settled up 🤝
            </button>
          </div>

          {/* chunky search and sort ui */}
          {!isLoading && trips.length > 0 && (
            <div className="flex gap-2 mb-6">
              <div className="relative flex-2">
                <input
                  type="text"
                  placeholder="find a trip..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 text-sm font-bold border-2 border-stone-100 shadow-sm rounded-2xl focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all bg-white text-stone-700 placeholder:text-stone-300"
                />
                <svg
                  className="w-5 h-5 text-stone-400 absolute left-4 top-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <CustomSelect
                value={sortBy}
                onChange={(val) =>
                  setSortBy(val as "newest" | "oldest" | "a_z" | "z_a")
                }
                options={[
                  { value: "newest", label: "newest" },
                  { value: "oldest", label: "oldest" },
                  { value: "a_z", label: "a - z" },
                  { value: "z_a", label: "z - a" },
                ]}
              />
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
            <div className="text-center py-16 bg-white rounded-4xl shadow-sm border-2 border-dashed border-stone-200">
              <div className="text-5xl mb-4 animate-bounce inline-block">
                🕊️
              </div>
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
            </div>
          ) : (
            <div className="space-y-4">
              {processedTrips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="w-full bg-white p-5 sm:p-6 rounded-3xl shadow-sm border-2 border-stone-100 hover:shadow-md hover:border-emerald-200 transition-all text-left flex justify-between items-center group active:scale-[0.98]"
                >
                  <div className="flex flex-col gap-1.5 pr-4 min-w-0">
                    <h3 className="font-extrabold text-stone-800 text-lg sm:text-xl truncate group-hover:text-emerald-700 transition-colors">
                      {trip.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-wider">
                      <span>
                        {new Date(trip.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {trip.members && trip.members.length > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            {trip.members.length}{" "}
                            {trip.members.length === 1 ? "member" : "members"}
                          </span>
                        </>
                      )}
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
            </div>
          )}
        </div>

        {/* magical bouncy fab */}
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="fixed bottom-8 right-8 lg:bottom-12 lg:right-12 w-16 h-16 bg-stone-900 text-white rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.4)] flex items-center justify-center text-3xl pb-1 hover:bg-emerald-600 hover:scale-110 active:scale-90 transition-all duration-300 z-40 group"
          >
            <span className="group-hover:rotate-90 transition-transform duration-300">
              +
            </span>
          </button>
        )}

        {/* bottom sheet style form overlay */}
        {isCreating && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
              {/* cute drag handle line for mobile */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden"></div>

              <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
                <h2 className="text-2xl font-black text-stone-800">
                  start a tab 🚀
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
      </div>
    </main>
  );
}
