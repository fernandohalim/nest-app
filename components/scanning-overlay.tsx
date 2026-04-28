"use client";

import { useEffect, useState } from "react";
export type ScanStage = "uploading" | "reading" | "extracting" | "idle";

interface ScanningOverlayProps {
  stage: ScanStage;
}

interface StageDisplay {
  label: string;
  hint: string;
  icon: string;
}

const STAGES: Record<Exclude<ScanStage, "idle">, StageDisplay> = {
  uploading: {
    label: "uploading...",
    hint: "sending receipt to the cloud",
    icon: "📤",
  },
  reading: {
    label: "reading...",
    hint: "letting gemini do the math",
    icon: "🔍",
  },
  extracting: {
    label: "extracting items...",
    hint: "almost there!",
    icon: "✨",
  },
};

export default function ScanningOverlay({ stage }: ScanningOverlayProps) {
  // tracks elapsed ms in the current stage so we can show a soft "this is
  // taking a moment..." hint if a single stage stalls. we don't show this
  // for the first ~5s to avoid noise on fast scans.
  const [stalledMs, setStalledMs] = useState(0);
  const [prevStage, setPrevStage] = useState(stage);

  if (stage !== prevStage) {
    setPrevStage(stage);
    setStalledMs(0);
  }

  useEffect(() => {
    if (stage === "idle") return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      setStalledMs(Date.now() - startedAt);
    }, 1000);

    return () => clearInterval(interval);
  }, [stage]);

  if (stage === "idle") return null;

  const display = STAGES[stage];
  const isStalled = stalledMs > 8000;

  return (
    <div
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
      aria-label={display.label}
    >
      <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden">
        <div className="text-4xl relative z-10" aria-hidden="true">
          📝
        </div>
        <div
          className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] z-20"
          style={{ animation: "scan 1.5s ease-in-out infinite" }}
          aria-hidden="true"
        >
          <style>{`@keyframes scan {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }`}</style>
        </div>
      </div>

      <h3 className="text-xl font-black text-white tracking-wide mb-2 flex items-center gap-2">
        <span aria-hidden="true">{display.icon}</span>
        <span key={stage} className="animate-in fade-in duration-300">
          {display.label}
        </span>
      </h3>

      {/* indeterminate shimmer bar - honest about not knowing exact progress */}
      <div className="w-48 sm:w-64 bg-stone-800 rounded-full h-1.5 mb-3 overflow-hidden shadow-inner border border-stone-700 relative">
        <div
          className="absolute inset-0 bg-emerald-400/30"
          aria-hidden="true"
        ></div>
        <div
          className="absolute top-0 bottom-0 w-1/3 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]"
          style={{
            animation: "shimmer 1.4s ease-in-out infinite",
          }}
          aria-hidden="true"
        ></div>
        <style>{`@keyframes shimmer {
          0% { left: -33%; }
          100% { left: 100%; }
        }`}</style>
      </div>

      <p className="text-emerald-400 font-bold text-[11px] mt-1 tracking-widest uppercase drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
        {display.hint}
      </p>

      {isStalled && (
        <p className="text-stone-500 font-bold text-[10px] mt-4 uppercase tracking-widest animate-in fade-in duration-500">
          taking a little longer than usual...
        </p>
      )}
    </div>
  );
}
