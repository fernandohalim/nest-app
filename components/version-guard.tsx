"use client";

import { useEffect } from "react";
import packageJson from "../package.json";
import { useAlertStore } from "@/store/useAlertStore";

// the previous behavior:
//   window.addEventListener("focus", nukeAndCheck);
//   nukeAndCheck() { unregister all SWs, then fetch version.json }
//
// this meant every tab-back unregistered the service worker - destroying
// the very thing that powers offline support. the OfflineScreen UI was
// effectively unreachable because the SW never lived long enough to cache.
//
// new behavior:
//   - check version on mount (after a short delay)
//   - check version when the page becomes visible AGAIN, but only if it's
//     been at least CHECK_INTERVAL_MS since the last check
//   - if the version differs, show the user a notice and reload. ONLY
//     unregister SWs and clear caches at that point - i.e. when we have
//     actual evidence of staleness. otherwise leave them alone.

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY_MS = 500;

export default function VersionGuard() {
  const { showAlert } = useAlertStore();

  useEffect(() => {
    let lastCheckedAt = 0;
    let isUpdating = false;

    const performUpdate = async () => {
      if (isUpdating) return;
      isUpdating = true;

      try {
        showAlert(
          "downloading the latest magic... your app will refresh in a second! ✨",
          "new update found! 🚀",
        );

        // unregister service workers ONLY now, when we know the cache is stale
        if ("serviceWorker" in navigator) {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        }

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }

        setTimeout(() => {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("updated", Date.now().toString());
          window.location.href = currentUrl.toString();
        }, 2500);
      } catch (error) {
        console.warn("version update failed:", error);
        isUpdating = false;
      }
    };

    const checkVersion = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheckedAt < CHECK_INTERVAL_MS) return;
      lastCheckedAt = now;

      try {
        const res = await fetch(`/version.json?t=${now}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        const clientVersion = packageJson.version;
        const serverVersion = data.version;

        if (serverVersion && serverVersion !== clientVersion) {
          performUpdate();
        }
      } catch (error) {
        // network failure (offline, etc.) is expected and silent
        console.warn("version check failed (likely offline):", error);
      }
    };

    // initial check on mount, after a brief delay
    const initialTimeout = setTimeout(
      () => checkVersion(true),
      INITIAL_DELAY_MS,
    );

    // re-check when the page becomes visible (debounced by CHECK_INTERVAL_MS)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkVersion(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialTimeout);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [showAlert]);

  return null;
}
