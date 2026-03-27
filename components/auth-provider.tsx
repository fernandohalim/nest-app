"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTripStore } from "@/store/useTripStore";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setUser } = useTripStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // 1. check for an active session when the app first loads
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);

      const isPublicRoute = pathname.startsWith("/trip/");

      // if no user and they aren't already on the login page, kick them out!
      if (!session?.user && pathname !== "/login" && !isPublicRoute) {
        router.push("/login");
      }
      setIsInitializing(false);
    };

    checkSession();

    // 2. silently listen for any login/logout events in the background
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);

      const isPublicRoute = pathname.startsWith("/trip/");

      if (!session?.user && pathname !== "/login" && !isPublicRoute) {
        router.push("/login");
      } else if (session?.user && pathname === "/login") {
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, setUser]);

  // show a completely blank screen for a split second while we check their cookies
  // so we don't accidentally flash the dashboard to a logged-out user
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
        <div className="relative w-16 h-16 flex items-center justify-center mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xl animate-pulse">🐣</span>
        </div>
        <p className="text-sm text-stone-500 font-bold tracking-wide">
          warming up the nest...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
