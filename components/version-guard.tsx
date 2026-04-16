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
          }
        }

        // 🔥 check if we are offline first to save a network request!
        if (!navigator.onLine) return;

        const res = await fetch(
          `https://nest-splitbill-app.vercel.app/version.json?t=${Date.now()}`,
        );

        // 🔥 Make sure the response is actually OK before trying to parse JSON!
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
          }

          setTimeout(() => {
            window.location.reload();
          }, 2500);
        }
      } catch {
        // silently fail if we can't reach the server
        console.warn("failed to check version, continuing anyway.");
      }
    };

    nukeAndCheck();
    window.addEventListener("focus", nukeAndCheck);
    return () => window.removeEventListener("focus", nukeAndCheck);
  }, [showAlert]);

  return null;
}
