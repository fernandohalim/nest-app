"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { v4 as uuidv4 } from "uuid";
import ProfileMenu from "@/components/profile-menu";

export default function Home() {
  const router = useRouter();

  // grab the fetchTrips function and loading state from our new supabase store
  const { trips, addTrip, fetchTrips, isLoading } = useTripStore();

  const [newTripName, setNewTripName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // fetch all trips from the database when the app loads
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    const newTripId = uuidv4();
    const newTrip = {
      id: newTripId,
      name: newTripName.trim(),
      date: new Date().toISOString().split("T")[0], // defaults to today
      currency: "IDR",
      members: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    };

    // save to supabase
    await addTrip(newTrip);
    setNewTripName("");
    setIsCreating(false);

    // instantly navigate to the new trip room
    router.push(`/trip/${newTripId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        {/* header */}
        <div className="flex justify-between items-start mb-8 pt-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-1">
              bills app
            </h1>
            <p className="text-sm text-gray-500">
              split expenses with friends, instantly.
            </p>
          </div>
          <ProfileMenu />
        </div>

        {/* create new trip button/form */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full bg-black text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-medium shadow-sm hover:bg-gray-800 transition-colors mb-8"
          >
            <span className="text-lg">+</span> start a new trip
          </button>
        ) : (
          <form
            onSubmit={handleCreateTrip}
            className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col gap-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium">name your trip</h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-gray-400 hover:text-black text-xl leading-none"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              autoFocus
              placeholder="e.g. bali 2026, friday dinner..."
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              className="w-full border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-black bg-transparent"
            />
            <button
              type="submit"
              className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors mt-2"
            >
              create & invite friends
            </button>
          </form>
        )}

        {/* trips list */}
        <div>
          <h2 className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wider">
            your recent trips
          </h2>

          {isLoading && trips.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs text-gray-500">syncing with cloud...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">
                no trips yet. tap above to start!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left flex justify-between items-center group"
                >
                  <div className="flex flex-col gap-1 pr-4 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {trip.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>
                        {new Date(trip.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white group-hover:border-black transition-colors">
                    →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
