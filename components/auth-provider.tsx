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
  const user = useTripStore((s) => s.user);
  const setUser = useTripStore((s) => s.setUser);
  const fetchOrCreateProfile = useTripStore((s) => s.fetchOrCreateProfile);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        await fetchOrCreateProfile(session.user);
      }

      setIsInitializing(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      // fire-and-forget — components that depend on profile will re-render
      // when it lands. blocking here would cause UI jitter on tab focus etc.
      if (session?.user) {
        fetchOrCreateProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, fetchOrCreateProfile]);

  useEffect(() => {
    if (isInitializing) return;

    const isPublicRoute =
      pathname.startsWith("/trip/") ||
      pathname === "/changelog" ||
      pathname.startsWith("/expense/");
    const isAuthRoute = pathname === "/login" || pathname === "/auth/callback";

    if (!user && !isAuthRoute && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isAuthRoute) {
      router.replace("/");
    }
  }, [user, pathname, isInitializing, router]);

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
