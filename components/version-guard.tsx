"use client";

import { useEffect } from "react";
import packageJson from "../package.json";
import { useAlertStore } from "@/store/useAlertStore";

export default function VersionGuard() {
  const { showAlert } = useAlertStore();

  useEffect(() => {
    const nukeAndCheck = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
            console.log("💀 service worker assassinated");
          }
        }

        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

        if (!res.ok) {
          console.warn("version.json not found yet, skipping check.");
          return;
        }

        const data = await res.json();
        const clientVersion = packageJson.version;
        const serverVersion = data.version;

        if (serverVersion && serverVersion !== clientVersion) {
          showAlert(
            "downloading the latest magic... your app will refresh in a second! ✨",
            "new update found! 🚀",
          );

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
            console.log("🧹 old cache wiped out");
          }

          setTimeout(() => {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set("updated", Date.now().toString());
            window.location.href = currentUrl.toString();
          }, 2500);
        }
      } catch (error) {
        console.warn("failed to check version (likely offline).", error);
      }
    };

    const timeoutId = setTimeout(() => {
      nukeAndCheck();
    }, 500);

    window.addEventListener("focus", nukeAndCheck);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("focus", nukeAndCheck);
    };
  }, [showAlert]);

  return null;
}
