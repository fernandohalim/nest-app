"use client";

import { useRouter } from "next/navigation";
import packageJson from "../package.json";
import { AboutModalProps } from "@/lib/types";

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      {/* backdrop */}
      <div className="fixed inset-0" onClick={onClose}></div>

      {/* modal body */}
      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0 z-10">
        {/* mobile grab handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden z-20"></div>

        {/* close button */}
        <div className="px-6 py-5 pt-8 sm:pt-6 flex justify-end items-center absolute top-0 right-0 w-full z-20">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg shadow-sm"
          >
            ×
          </button>
        </div>

        {/* brand background gradient */}
        <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-emerald-100/50 to-transparent z-0"></div>

        <div className="p-8 pt-12 flex flex-col items-center text-center relative z-10">
          {/* 🔥 NEW CHICK ICON HERO */}
          <div className="relative mb-6 group mt-4 cursor-pointer">
            {/* dynamic brand texture backdrop */}
            <div className="absolute inset-0 bg-emerald-300 opacity-40 rounded-full blur-2xl group-hover:opacity-60 transition-opacity duration-500"></div>

            {/* the chick icon */}
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center relative z-10 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
              <span className="text-5xl select-none group-hover:rotate-12 transition-transform duration-300">
                🐣
              </span>
            </div>

            {/* sparkles */}
            <div className="absolute -bottom-1 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] z-20 shadow-sm animate-bounce drop-shadow-md">
              ✨
            </div>
            <div className="absolute -top-1 -left-2 w-6 h-6 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px] z-20 shadow-sm animate-[bounce_2s_infinite_100ms] drop-shadow-md opacity-40">
              ⚡
            </div>
          </div>

          {/* brand title & dev credit */}
          <div className="flex flex-col gap-0.5 mb-8">
            <h2 className="text-3xl font-black text-stone-800 tracking-tighter">
              nest.
            </h2>
            <p className="text-sm font-bold text-stone-500 mb-2">
              splitting bills, keeping the peace.
            </p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2.5 py-1.5 bg-stone-100 rounded-lg border border-stone-200 shadow-inner">
              crafted by Fernando Halim 🚀
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            {/* changelog button */}
            <button
              onClick={() => {
                onClose();
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

            {/* REAL SVG SOCIAL ICON ROW */}
            <div className="flex justify-center items-center gap-3 mb-1 w-full p-2">
              {/* Globe / Website */}
              <a
                href="https://fernando-halim.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                title="check out my porto website"
                className="shrink-0 w-14 h-14 bg-white border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.95] shadow-sm"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com/in/fernando-halimm"
                target="_blank"
                rel="noopener noreferrer"
                title="connect on linkedin"
                className="shrink-0 w-14 h-14 bg-white border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.95] shadow-sm"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/fernandohalim"
                target="_blank"
                rel="noopener noreferrer"
                title="follow me on github"
                className="shrink-0 w-14 h-14 bg-white border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-50 hover:border-stone-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.95] shadow-sm"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>

              {/* Mail */}
              <a
                href="mailto:fernandohalim26@gmail.com"
                title="say hello via email"
                className="shrink-0 w-14 h-14 bg-white border-2 border-stone-100 rounded-2xl flex items-center justify-center text-stone-400 hover:text-amber-500 hover:bg-amber-50 hover:border-amber-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.95] shadow-sm"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </a>
            </div>

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
