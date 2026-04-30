"use client";

import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";

export default function AppIconPreview() {
  const iconRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    if (iconRef.current === null) {
      return;
    }

    // perfectly locked to 500x500 with a 1:1 pixel ratio
    toPng(iconRef.current, {
      cacheBust: true,
      width: 500,
      height: 500,
      pixelRatio: 1,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "nest-app-icon.png";
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("failed to generate icon", err);
      });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-300 p-10 font-sans selection:bg-none overflow-auto">
      <button
        onClick={handleDownload}
        className="mb-12 px-6 py-3 bg-stone-900 text-emerald-400 font-bold uppercase tracking-widest rounded-xl shadow-lg hover:bg-stone-800 transition-colors border-2 border-stone-700 flex items-center gap-2 shrink-0"
      >
        <span>📸 download 500x500 icon</span>
      </button>

      {/* 500x500 App Icon Frame */}
      <div
        ref={iconRef}
        className="relative shrink-0 w-125 h-125 bg-emerald-400 flex items-center justify-center overflow-hidden shadow-[0_20px_50px_rgba(8,47,73,0.15)] border-8 border-emerald-300"
        style={{ borderRadius: "112px" }} // perfect app-icon squircle ratio
      >
        {/* subtle background pattern to match the nest aesthetic */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="iconGrid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="2" fill="#292524" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#iconGrid)" />
        </svg>

        {/* hatching chick emoji perfectly centered */}
        <span
          className="text-[260px] drop-shadow-xl transform -translate-y-2"
          style={{ lineHeight: 1 }}
        >
          🐣
        </span>
      </div>
    </div>
  );
}
