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

      // if no user and they aren't already on the login page, kick them out!
      if (!session?.user && pathname !== "/login") {
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
      if (!session?.user && pathname !== "/login") {
        router.push("/login");
      } else if (session?.user && pathname === "/login") {
        router.push("/"); // kick them to dashboard if they try to visit login while logged in
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, setUser]);

  // show a completely blank screen for a split second while we check their cookies
  // so we don't accidentally flash the dashboard to a logged-out user
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
}
