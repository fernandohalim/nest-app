"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useTripStore } from "@/store/useTripStore";
import { CreateTripModalProps } from "@/lib/types";
import CustomSelect from "./custom-select";

export const CURRENCIES = [
  { value: "IDR", label: "🇮🇩 IDR (Rp)" },
  { value: "SGD", label: "🇸🇬 SGD ($)" },
  { value: "MYR", label: "🇲🇾 MYR (RM)" },
  { value: "THB", label: "🇹🇭 THB (฿)" },
  { value: "JPY", label: "🇯🇵 JPY (¥)" },
  { value: "KRW", label: "🇰🇷 KRW (₩)" },
  { value: "AUD", label: "🇦🇺 AUD ($)" },
  { value: "USD", label: "🇺🇸 USD ($)" },
  { value: "EUR", label: "🇪🇺 EUR (€)" },
  { value: "GBP", label: "🇬🇧 GBP (£)" },
];

export default function CreateTripModal({
  isOpen,
  onClose,
}: CreateTripModalProps) {
  const router = useRouter();
  const { addTrip } = useTripStore();
  const [newTripName, setNewTripName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName.trim()) return;

    setIsSubmitting(true);

    const newTripId = uuidv4();
    const newTrip = {
      id: newTripId,
      name: newTripName.trim(),
      date: new Date().toISOString().split("T")[0],
      currency: currency,
      members: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      status: "ongoing",
    };

    await addTrip(newTrip);
    setNewTripName("");
    setCurrency("IDR");
    setIsSubmitting(false);
    onClose();

    router.push(`/trip/${newTripId}`);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0" onClick={onClose}></div>

      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-visible relative pb-8 sm:pb-0">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden z-20"></div>

        <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] z-10 shadow-sm">
          <h2 className="text-2xl font-black text-stone-800">
            start a trip 🚀
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-6 pt-8">
          <form onSubmit={handleCreateTrip} className="flex flex-col gap-6">
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

            <div className="flex flex-col gap-2 relative z-20">
              <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                base currency
              </label>
              <CustomSelect
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES}
                className="w-full"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newTripName.trim()}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/20 hover:shadow-emerald-600/30 active:scale-95 disabled:bg-stone-300 disabled:shadow-none flex justify-center items-center mt-2 relative z-10"
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
  );
}
