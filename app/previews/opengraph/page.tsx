"use client";

import { useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import Emoji from "@/components/emoji";

export default function OGPreviewSpatialUI() {
  const imageRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    if (imageRef.current === null) {
      return;
    }

    // added pixelRatio: 1 so your macbook retina screen doesn't double the size
    toPng(imageRef.current, {
      cacheBust: true,
      width: 1200,
      height: 630,
      pixelRatio: 1,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "nest-opengraph.png";
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error("failed to generate image", err);
      });
  }, [imageRef]);

  return (
    // changed to overflow-auto so you can scroll if your screen is too small
    <div className="flex flex-col items-center min-h-screen bg-stone-300 p-10 font-sans selection:bg-none overflow-auto">
      <button
        onClick={handleDownload}
        className="mb-8 px-6 py-3 bg-stone-900 text-emerald-400 font-bold uppercase tracking-widest rounded-xl shadow-lg hover:bg-stone-800 transition-colors border-2 border-stone-700 flex items-center gap-2 shrink-0"
      >
        <span>📸 download 1200x630 png</span>
      </button>

      {/* added shrink-0, min-w-[1200px], and min-h-[630px] to prevent flexbox from crushing it */}
      <div
        ref={imageRef}
        className="relative shrink-0 w-300 min-w-300 h-157.5 min-h-157.5 bg-emerald-50 overflow-hidden shadow-[0_20px_50px_rgba(8,47,73,0.1)] border-12 border-white"
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="dotGrid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="2" fill="#292524" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />
        </svg>

        <div className="absolute -top-32 -right-10 w-137.5 h-137.5 bg-emerald-200/60 rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-10 w-175 h-175 bg-emerald-200/50 rounded-full pointer-events-none"></div>
        <div className="absolute top-32 left-1/4 w-40 h-40 bg-stone-200/70 rounded-full pointer-events-none"></div>

        <div className="absolute top-10 right-6 transform rotate-6 bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-emerald-200 flex flex-col items-center z-20">
          <span className="text-sm font-black text-stone-400 uppercase tracking-widest block mb-3">
            total group spend
          </span>
          <div className="bg-[#fdfbf7] rounded-4xl px-8 py-4 border-2 border-stone-100 shadow-inner">
            <span className="text-5xl font-black text-emerald-500 flex items-start justify-center">
              <span className="text-2xl mt-1.5 mr-2 text-emerald-400">Rp</span>
              2,660,902
            </span>
          </div>
        </div>

        <div className="absolute top-24 left-24 transform -rotate-6 bg-white p-6 rounded-4xl shadow-2xl border-2 border-emerald-200 flex flex-col gap-4 z-20 items-center">
          <span className="text-xs font-black text-stone-300 uppercase tracking-widest text-center">
            the crew
          </span>
          <div className="flex gap-3 relative">
            <span className="text-sm font-extrabold bg-stone-100 border border-stone-200/80 text-stone-600 px-4 py-2 rounded-xl">
              kiwe
            </span>

            <div className="relative">
              <span className="text-sm font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl block">
                cuket
              </span>
              <div className="absolute -top-3 -right-4 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-md transform rotate-12">
                paid
              </div>
            </div>

            <span className="text-sm font-extrabold bg-stone-100 border border-stone-200/80 text-stone-600 px-4 py-2 rounded-xl shadow-sm">
              you
            </span>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 transform -rotate-354 z-20">
          <div className="bg-white p-4 rounded-4xl shadow-2xl border-2 border-emerald-200 flex items-center gap-5 relative">
            <div className="w-16 h-16 bg-orange-50 border border-orange-100 rounded-[1.25rem] flex items-center justify-center shadow-inner">
              <Emoji char="🍜" className="h-8! w-8!" />{" "}
            </div>
            <div className="flex flex-col pr-6 pb-2">
              <span className="text-xs font-black text-stone-400 uppercase tracking-widest mb-1">
                ichiraku ramen
              </span>
              <span className="text-xl font-bold text-stone-700 leading-none">
                Rp 350,000
              </span>
            </div>

            <div className="absolute -bottom-3 right-6 bg-emerald-100 border border-emerald-200 text-emerald-600 px-3 py-1 rounded-full shadow-md flex items-center transform">
              <span className="text-[10px] font-black uppercase tracking-widest">
                ✓ settled
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Right: Stacked Trip Tags (Vertical Stack) */}
        <div className="absolute bottom-20 right-18 rotate-354 z-20 flex flex-col items-center">
          {/* Bottom-most card shadow layer */}
          <div className="absolute top-8 w-[90%] h-full bg-emerald-200/40 rounded-3xl -z-20 border-2 border-emerald-300/30"></div>

          {/* Middle card shadow layer */}
          <div className="absolute top-4 w-[95%] h-full bg-white/80 rounded-3xl -z-10 border-2 border-emerald-100 shadow-sm"></div>

          {/* Top Primary card */}
          <div className="bg-white shadow-2xl rounded-3xl p-2 border-2 border-emerald-100">
            <span className="font-bold px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm uppercase tracking-widest border border-emerald-200 block flex items-center gap-2">
              <Emoji char="🌴" /> bali getaway
            </span>
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <h1
            className="text-[150px] font-black text-stone-800 tracking-tighter leading-none mt-4 mb-2"
            style={{
              WebkitTextStroke: "46px white",
              paintOrder: "stroke fill",
              filter: "drop-shadow(0 10px 20px rgba(16, 185, 129, 0.2))",
            }}
          >
            nest.
          </h1>

          <div className="w-28 border-t-[6px] border-dashed border-stone-300/80 my-2"></div>

          <div className="bg-white px-8 py-4 mt-2 rounded-full border-2 border-emerald-200 shadow-xl pointer-events-auto">
            <p className="text-xl font-bold text-stone-500 uppercase tracking-[0.3em]">
              split expenses,{" "}
              <span className="text-emerald-500">
                keep the peace <Emoji char="🌱" />
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
