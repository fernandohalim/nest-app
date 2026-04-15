"use client";

import { useRouter } from "next/navigation";
import packageJson from "../package.json";
import { AboutModalProps } from "@/lib/types";

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden z-20"></div>

        <div className="px-6 py-5 pt-8 sm:pt-6 flex justify-end items-center absolute top-0 right-0 w-full z-20">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg shadow-sm"
          >
            ×
          </button>
        </div>

        <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-emerald-100/50 to-transparent z-0"></div>

        <div className="p-8 pt-12 flex flex-col items-center text-center relative z-10">
          <div className="relative mb-5 group cursor-pointer mt-4">
            <div className="absolute inset-0 bg-emerald-300 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center relative z-10 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
              <span className="font-black text-emerald-900 tracking-tighter text-4xl lowercase select-none">
                fh
              </span>
            </div>
            <div className="absolute -bottom-1 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] z-20 shadow-sm animate-bounce drop-shadow-md">
              ✨
            </div>
            <div className="absolute -top-1 -left-2 w-6 h-6 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] z-20 shadow-sm animate-[bounce_2s_infinite_100ms] drop-shadow-md">
              ⚡
            </div>
          </div>

          <div className="flex flex-col gap-0.5 mb-8">
            <h2 className="text-2xl font-black text-stone-800 tracking-tight">
              fernando halim
            </h2>
            <p className="text-sm font-bold text-emerald-600">
              indie maker & developer 🚀
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => {
                onClose(); // close modal before navigating
                router.push("/changelog");
              }}
              className="w-full flex items-center justify-between p-4 sm:p-5 bg-stone-900 border-2 border-stone-900 rounded-2xl hover:bg-stone-800 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group mb-1"
            >
              <div className="flex items-center gap-3.5 text-white font-extrabold text-sm">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-inner border border-white/5">
                  ✨
                </div>
                what&apos;s new in nest
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] font-black uppercase tracking-widest bg-violet-500 text-white px-2.5 py-1 rounded-lg border border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.5)]">
                  v{packageJson.version}
                </span>
                <svg
                  className="w-4 h-4 text-stone-400 group-hover:text-violet-400 transition-colors duration-300 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>

            <a
              href="https://fernando-halim.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm group-hover:text-emerald-900 transition-colors">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-base group-hover:bg-emerald-200 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300">
                  🌍
                </div>
                check out my porto website
              </div>
            </a>

            <a
              href="https://linkedin.com/in/fernando-halimm"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:bg-blue-50 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm group-hover:text-blue-900 transition-colors">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-base group-hover:bg-blue-200 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  💼
                </div>
                connect on linkedin
              </div>
            </a>

            <a
              href="https://github.com/fernandohalim"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:bg-stone-50 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm group-hover:text-stone-900 transition-colors">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-base group-hover:bg-stone-200 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300">
                  🐙
                </div>
                follow me on github
              </div>
            </a>

            <a
              href="mailto:fernandohalim26@gmail.com"
              className="w-full flex items-center justify-between p-4 bg-white border-2 border-stone-100 rounded-2xl hover:bg-amber-50 hover:border-amber-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group"
            >
              <div className="flex items-center gap-3.5 text-stone-700 font-bold text-sm group-hover:text-amber-900 transition-colors">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-base group-hover:bg-amber-200 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  💌
                </div>
                say hello via email
              </div>
            </a>

            <a
              href="https://github.com/fernandohalim/nest-app"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-[11px] font-black text-stone-400 uppercase tracking-widest hover:text-emerald-500 transition-colors flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 duration-300"
            >
              view nest source code 🐣
            </a>
          </div>

          <div className="mt-8 text-[10px] font-black text-stone-300 uppercase tracking-widest border-t-2 border-dashed border-stone-100 pt-6 w-full text-center">
            nest v{packageJson.version} • keeping the peace
          </div>
        </div>
      </div>
    </div>
  );
}
