"use client";

import { useRouter } from "next/navigation";
import { useUiStore } from "@/store/useUiStore";

// The "what's the plan?" launcher — start a trip, scan a receipt, or enter one
// manually. Extracted out of the home page so the desktop sidebar can open it
// from any route; state lives in useUiStore. On mobile it's a bottom-sheet, on
// sm+ a centered dialog (matching the rest of the modal layer).
export default function ActionMenu() {
  const router = useRouter();
  const isOpen = useUiStore((s) => s.isActionMenuOpen);
  const close = useUiStore((s) => s.closeActionMenu);
  const openCreateTrip = useUiStore((s) => s.openCreateTrip);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-menu-title"
    >
      <div
        className="fixed inset-0"
        onClick={close}
        aria-hidden="true"
      ></div>

      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 p-6 pt-8 pb-12 sm:pb-8 relative z-10">
        <button
          onClick={close}
          aria-label="close"
          className="absolute top-6 right-6 w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold"
        >
          ×
        </button>
        <h2
          id="action-menu-title"
          className="text-2xl font-black text-stone-800 mb-2"
        >
          what&apos;s the plan?
        </h2>
        <p className="text-sm font-bold text-stone-400 mb-8">
          create a group trip or split a quick receipt.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              close();
              openCreateTrip();
            }}
            className="w-full flex items-center gap-4 bg-white border-2 border-stone-100 p-4 rounded-2xl hover:border-emerald-200 hover:shadow-[0_8px_30px_rgb(16,185,129,0.1)] active:scale-95 transition-all text-left group"
          >
            <div
              className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-500 text-2xl shadow-inner shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors"
              aria-hidden="true"
            >
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
            <div
              className="h-0.5 w-full bg-stone-100 rounded-full"
              aria-hidden="true"
            ></div>
            <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest shrink-0">
              quick splits
            </span>
            <div
              className="h-0.5 w-full bg-stone-100 rounded-full"
              aria-hidden="true"
            ></div>
          </div>

          <button
            onClick={() => {
              close();
              router.push("/quick-split?action=scan");
            }}
            className="w-full flex items-center gap-4 bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all text-left"
          >
            <div
              className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-sm shrink-0 relative overflow-hidden"
              aria-hidden="true"
            >
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
              close();
              router.push("/quick-split?action=manual");
            }}
            className="w-full flex items-center gap-4 bg-white border-2 border-stone-100 p-4 rounded-2xl hover:bg-stone-50 hover:border-stone-200 active:scale-95 transition-all text-left"
          >
            <div
              className="w-14 h-14 bg-stone-50 border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 text-2xl shadow-sm shrink-0"
              aria-hidden="true"
            >
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
  );
}
