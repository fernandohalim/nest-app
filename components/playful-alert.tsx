"use client";

import { AlertTone, useAlertStore } from "@/store/useAlertStore";
import { usePresence } from "@/lib/use-presence";
import { useSheetDismiss } from "@/lib/use-sheet-dismiss";

// the badge on top of an alert. used to be guessed from the title's emoji,
// which gave "kept forever 📌" and every "how x works" explainer a 🛑.
const TONE_EMOJI: Record<AlertTone, string> = {
  warn: "🛑",
  error: "💥",
  success: "✨",
  info: "💡",
};

function usePlayfulAlertLogic() {
  const {
    isOpen,
    type,
    tone,
    title,
    message,
    confirmText,
    cancelText,
    severity,
    close,
    confirm,
  } = useAlertStore();

  const getEmoji = () => {
    if (type === "alert") return TONE_EMOJI[tone];
    // for confirms, the severity drives the affect
    if (severity === "destructive") return "🧨";
    return "🤔";
  };

  const getConfirmButtonStyles = () => {
    if (type === "confirm" && severity === "destructive") {
      return "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20";
    }
    return "bg-stone-900 hover:bg-emerald-500 shadow-stone-900/20 hover:shadow-emerald-500/30";
  };

  return {
    isOpen,
    type,
    title,
    message,
    confirmText,
    cancelText,
    close,
    confirm,
    emoji: getEmoji(),
    confirmButtonStyles: getConfirmButtonStyles(),
  };
}

export default function PlayfulAlert() {
  const {
    isOpen,
    type,
    title,
    message,
    confirmText,
    cancelText,
    close,
    confirm,
    emoji,
    confirmButtonStyles,
  } = usePlayfulAlertLogic();

  // escape + scroll lock; it zooms in, so no swipe (lib/use-sheet-dismiss.ts)
  const popupRef = useSheetDismiss(close, { swipe: false });
  const presence = usePresence(isOpen);
  if (!presence.render) return null;

  return (
    <div
      data-closing={presence.closing || undefined}
      className="fixed inset-0 z-9999 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-message"
    >
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={type === "alert" ? close : undefined}
        aria-hidden="true"
      />

      <div
        ref={popupRef}
        className="bg-[#fdfbf7] rounded-[2.5rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl relative z-10 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 flex flex-col items-center text-center border-4 border-white mt-8"
      >
        <div
          className="absolute -top-10 w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl border-4 border-[#fdfbf7] shadow-sm transform hover:scale-110 transition-transform duration-300"
          aria-hidden="true"
        >
          {emoji}
        </div>

        <h3
          id="alert-title"
          className="text-2xl font-black text-stone-800 mb-3 mt-8"
        >
          {title}
        </h3>
        <p
          id="alert-message"
          className="text-sm font-bold text-stone-500 mb-8 leading-relaxed"
        >
          {message}
        </p>

        <div className="flex gap-3 w-full">
          {type === "confirm" && (
            <button
              onClick={close}
              className="flex-1 py-4 bg-white border-2 border-stone-200 text-stone-500 rounded-2xl text-sm font-black hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={confirm}
            autoFocus
            className={`flex-1 py-4 rounded-2xl text-sm font-black text-white transition-all shadow-xl active:scale-95 ${confirmButtonStyles}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
