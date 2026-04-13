"use client";

import { Transaction } from "@/lib/types";

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawDebts: { from: string; to: string; amount: number }[];
  settlements: Transaction[];
  currencySymbol?: string;
}

export default function SettlementModal({
  isOpen,
  onClose,
  rawDebts,
  settlements,
  currencySymbol = "Rp",
}: SettlementModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-md rounded-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl">
              ✨
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-700 rounded-full flex items-center justify-center transition-colors"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <h3 className="text-2xl font-black text-stone-800 leading-tight mb-2">
            debt simplification
          </h3>
          <p className="text-stone-500 font-bold text-sm leading-relaxed mb-6">
            nest automatically optimizes the group&apos;s debts. instead of
            everyone paying each other back for every single receipt, we
            minimize the total number of transactions.
          </p>

          <div className="space-y-6">
            {/* Before State */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 block">
                before (raw debts)
              </span>
              {rawDebts.length === 0 ? (
                <span className="text-sm font-bold text-stone-400">
                  no debts to show.
                </span>
              ) : (
                <div className="flex flex-col gap-2">
                  {rawDebts.map((debt, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="font-bold text-stone-600">
                        {debt.from} owes {debt.to}
                      </span>
                      <span className="font-black text-stone-400">
                        {currencySymbol}{" "}
                        {Number(debt.amount).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}{" "}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center -my-3 relative z-10">
              <div className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-stone-400 shadow-sm">
                ↓
              </div>
            </div>

            {/* After State */}
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <span className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-3 block">
                after (optimized by nest)
              </span>
              {settlements.length === 0 ? (
                <span className="text-sm font-bold text-emerald-600">
                  everything is settled!
                </span>
              ) : (
                <div className="flex flex-col gap-2">
                  {settlements.map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="font-bold text-emerald-800">
                        {s.from.name} pays {s.to.name}
                      </span>
                      <span className="font-black text-emerald-600">
                        {currencySymbol}{" "}
                        {Number(s.amount).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-100">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-stone-900 text-white font-extrabold rounded-full hover:bg-stone-800 active:scale-[0.98] transition-all"
          >
            got it
          </button>
        </div>
      </div>
    </div>
  );
}
