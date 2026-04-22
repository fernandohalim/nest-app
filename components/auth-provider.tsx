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
  const { user, setUser } = useTripStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // hook 1: talks to supabase and keeps our global store updated.
  useEffect(() => {
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsInitializing(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  // hook 2: watches where the user is going and acts as a bouncer.
  useEffect(() => {
    if (isInitializing) return;

    // define our safe zones
    const isPublicRoute =
      pathname.startsWith("/trip/") ||
      pathname === "/changelog" ||
      pathname.startsWith("/expense/");
    const isAuthRoute = pathname === "/login" || pathname === "/auth/callback";

    if (!user && !isAuthRoute && !isPublicRoute) {
      // not logged in
      router.replace("/login");
    } else if (user && isAuthRoute) {
      // logged in but trying to view the login page
      router.replace("/");
    }
  }, [user, pathname, isInitializing, router]);

  // prevent accidentally flash the dashboard to a logged-out user
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
