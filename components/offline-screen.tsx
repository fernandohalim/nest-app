"use client";

import { useSyncExternalStore } from "react";

// subscribe to the browser's online/offline events
const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};

// get the current status from the browser
const getSnapshot = () => {
  return navigator.onLine;
};

// fallback for server-side rendering (always assume online so it doesn't flash)
const getServerSnapshot = () => {
  return true;
};

export default function OfflineScreen() {
  // usesyncexternalstore safely reads external data without triggering that useeffect lint error!
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // if they are online, render nothing
  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-200 bg-[#fdfbf7]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-inner">
        <span className="text-4xl grayscale">🪹</span>
      </div>
      <h2 className="text-2xl font-black text-stone-800 mb-2 text-center">
        nest is sleeping...
      </h2>
      <p className="text-stone-500 font-bold text-center max-w-xs leading-relaxed">
        it looks like you lost your internet connection. we need the web to sync
        your trips with the group!
      </p>

      <div className="mt-8 px-6 py-3 bg-stone-200 text-stone-500 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
        waiting for signal
      </div>
    </div>
  );
}
