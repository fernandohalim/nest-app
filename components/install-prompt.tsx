"use client";

import { useEffect, useState } from "react";

// the web platform gives us two very different install stories:
//
//   - chromium (android chrome, desktop chrome/edge) fires a
//     `beforeinstallprompt` event we can stash and replay behind our own
//     button. this is a "real" one-tap install.
//   - ios safari has NO such event. the only way in is the native share
//     sheet -> "add to home screen". so for ios we can't install for the
//     user, we can only *show them how*.
//
// everything else (desktop firefox, ios chrome/firefox, in-app webviews,
// already-installed standalone sessions) gets nothing - we stay quiet
// rather than nag on a platform where install won't work anyway.

const DISMISS_KEY = "nest-install-prompt-dismissed";
const SHOW_DELAY_MS = 3500;

// minimal shape of the non-standard beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "chromium" | "ios" | null;

export default function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // already installed? never prompt.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // ios safari exposes this legacy flag when launched from home screen
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;

    // user already said "no thanks" - respect it.
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;

    // ipados 13+ masquerades as a mac, so also check for touch points
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // only real safari can "add to home screen" - crios/fxios/edgios can't
    const isSafari =
      /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);

    let showTimer: ReturnType<typeof setTimeout> | undefined;

    // --- chromium path: capture the native prompt ---
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop the mini-infobar, we'll drive it ourselves
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("chromium");
      showTimer = setTimeout(() => setIsVisible(true), SHOW_DELAY_MS);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // --- ios path: no event exists, so decide on our own ---
    if (isIOS && isSafari) {
      showTimer = setTimeout(() => {
        setMode("ios");
        setIsVisible(true);
      }, SHOW_DELAY_MS);
    }

    // if it gets installed (either path), disappear and don't nag again
    const handleInstalled = () => {
      localStorage.setItem(DISMISS_KEY, "installed");
      setIsVisible(false);
      setMode(null);
    };
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      if (showTimer) clearTimeout(showTimer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // either way the event can only be used once - burn it
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "installed");
    } else {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
    setIsVisible(false);
  };

  if (!isVisible || !mode) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-90 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      {/* backdrop - tap to dismiss, matching the rest of nest */}
      <div className="fixed inset-0" onClick={dismiss}></div>

      {/* modal body */}
      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-8 z-10">
        {/* close button */}
        <div className="px-6 py-5 pt-8 sm:pt-6 flex justify-end items-center absolute top-0 right-0 w-full z-20">
          <button
            type="button"
            onClick={dismiss}
            aria-label="dismiss install prompt"
            className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 hover:rotate-90 active:scale-90 transition-all font-bold text-lg shadow-sm"
          >
            ×
          </button>
        </div>

        {/* brand background gradient */}
        <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-emerald-100/50 to-transparent z-0"></div>

        <div className="p-8 pt-12 flex flex-col items-center text-center relative z-10">
          {/* chick hero */}
          <div className="relative mb-6 group mt-4">
            <div className="absolute inset-0 bg-emerald-300 opacity-40 rounded-full blur-2xl group-hover:opacity-60 transition-opacity duration-500"></div>
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center relative z-10 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
              <span className="text-5xl select-none group-hover:rotate-12 transition-transform duration-300">
                🐣
              </span>
            </div>
            <div className="absolute -bottom-1 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] z-20 shadow-sm animate-bounce drop-shadow-md">
              📲
            </div>
          </div>

          {/* copy */}
          <div className="flex flex-col gap-1.5 mb-8">
            <h2 className="text-2xl font-black text-stone-800 tracking-tighter">
              take nest with you
            </h2>
            <p className="text-sm font-bold text-stone-500 max-w-[16rem] leading-relaxed">
              install nest on your home screen for a full-screen, app-like
              experience. no app store needed! 🌱
            </p>
          </div>

          {mode === "chromium" ? (
            <div className="w-full flex flex-col gap-3">
              {/* one-tap install */}
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-3 p-4 sm:p-5 bg-stone-900 border-2 border-stone-900 rounded-2xl hover:bg-stone-800 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] group text-white font-extrabold text-sm"
              >
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 shadow-inner border border-white/5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                </div>
                install nest
              </button>
              <button
                onClick={dismiss}
                className="text-[11px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-600 transition-colors py-1"
              >
                maybe later
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              {/* ios manual instructions */}
              <div className="w-full flex items-center gap-3.5 p-4 bg-white border-2 border-stone-100 rounded-2xl shadow-sm text-left">
                <div className="shrink-0 w-9 h-9 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-500">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4" />
                    <path d="M8 8l4-4 4 4" />
                    <path d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-stone-600 leading-snug">
                  tap the{" "}
                  <span className="font-black text-sky-500">share</span> button
                  in safari&apos;s toolbar
                </p>
              </div>
              <div className="w-full flex items-center gap-3.5 p-4 bg-white border-2 border-stone-100 rounded-2xl shadow-sm text-left">
                <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="4" />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-stone-600 leading-snug">
                  choose{" "}
                  <span className="font-black text-emerald-500">
                    add to home screen
                  </span>
                </p>
              </div>
              <button
                onClick={dismiss}
                className="text-[11px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-600 transition-colors py-1 mt-1"
              >
                got it
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
