"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { Trip } from "@/lib/types";
import CustomSelect from "./custom-select";
import { CURRENCIES } from "./create-trip-modal";

interface TripSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export default function TripSettingsModal({
  isOpen,
  onClose,
  trip,
}: TripSettingsModalProps) {
  const router = useRouter();

  const updateTripDetails = useTripStore((s) => s.updateTripDetails);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const updateTripStatus = useTripStore((s) => s.updateTripStatus);
  const showConfirm = useAlertStore((s) => s.showConfirm);

  const [editTripName, setEditTripName] = useState(trip.name);
  const [editCurrency, setEditCurrency] = useState(trip.currency || "IDR");

  if (!isOpen) return null;

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTripName.trim()) {
      onClose();
      return;
    }
    await updateTripDetails(trip.id, editTripName.trim(), editCurrency);
    onClose();
  };

  // 🔥 U5 follow-through: explicit destructive severity for the nuke action.
  const handleFullTripDelete = () => {
    showConfirm(
      "whoa there! are you sure you want to delete this whole trip and all its expenses? this can't be undone.",
      async () => {
        await deleteTrip(trip.id);
        router.push("/");
      },
      {
        title: "nuke entire trip? 🧨",
        confirmText: "yes, destroy it",
        severity: "destructive",
      },
    );
  };

  const toggleStatus = async () => {
    await updateTripStatus(
      trip.id,
      trip.status === "finished" ? "ongoing" : "finished",
    );
    onClose();
  };

  const isFinished = trip.status === "finished";

  return (
    <div
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-settings-title"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div className="relative z-10 bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3
            id="trip-settings-title"
            className="text-2xl font-black text-stone-800"
          >
            trip settings ⚙️
          </h3>
          <button
            onClick={onClose}
            aria-label="close"
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all text-xl"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSaveDetails} className="mb-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="trip-rename-input"
              className="block text-sm font-bold text-stone-500 mb-2 ml-1"
            >
              rename trip
            </label>
            <input
              id="trip-rename-input"
              type="text"
              value={editTripName}
              onChange={(e) => setEditTripName(e.target.value)}
              className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all"
            />
          </div>

          <div className="relative z-20">
            <label className="block text-sm font-bold text-stone-500 mb-2 ml-1">
              base currency
            </label>
            <CustomSelect
              value={editCurrency}
              onChange={setEditCurrency}
              options={CURRENCIES}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3.5 bg-stone-900 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-md"
          >
            save changes
          </button>
        </form>
        <div className="border-t-2 border-stone-100 pt-8 mb-8">
          <div className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl border-2 border-stone-100">
            <div>
              <h4 className="text-base font-black text-stone-800">
                mark trip as settled 🔒
              </h4>
              <p className="text-xs font-bold text-stone-500 mt-1">
                {isFinished ? "re-open the trip?" : "mark as late trip?"}
              </p>
            </div>
            {/* 🔥 A2: real switch input */}
            <label className="cursor-pointer shrink-0">
              <input
                type="checkbox"
                role="switch"
                checked={isFinished}
                aria-checked={isFinished}
                aria-label="mark trip as settled"
                onChange={toggleStatus}
                className="sr-only peer"
              />
              <span
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors active:scale-95 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-100 ${isFinished ? "bg-emerald-500" : "bg-stone-300"}`}
                aria-hidden="true"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${isFinished ? "translate-x-7" : "translate-x-1"}`}
                />
              </span>
            </label>
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
  );
}
