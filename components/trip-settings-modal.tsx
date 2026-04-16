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

  // Perfectly typed! No "any" needed anymore!
  const { updateTripDetails, deleteTrip, updateTripStatus } = useTripStore();
  const { showConfirm } = useAlertStore();

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

  const handleFullTripDelete = () => {
    showConfirm(
      "whoa there! are you sure you want to delete this whole trip and all its expenses? this can't be undone.",
      async () => {
        await deleteTrip(trip.id);
        router.push("/");
      },
      "nuke entire trip? 🧨",
      "yes, destroy it",
    );
  };

  const toggleStatus = async () => {
    await updateTripStatus(
      trip.id,
      trip.status === "finished" ? "ongoing" : "finished",
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0" onClick={onClose}></div>

      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black text-stone-800">
            trip settings ⚙️
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all text-xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSaveDetails} className="mb-8 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-stone-500 mb-2 ml-1">
              rename trip
            </label>
            <input
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
                {trip.status === "finished"
                  ? "re-open the trip?"
                  : "mark as late trip?"}
              </p>
            </div>
            <button
              onClick={toggleStatus}
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
  );
}
