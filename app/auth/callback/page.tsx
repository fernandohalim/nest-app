"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || session) {
          router.replace("/");
        }
      },
    );

    // fallback just in case the event fired faster than the page rendered
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });

    return () => authListener.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fdfbf7] flex flex-col items-center justify-center p-6 selection:bg-emerald-200 selection:text-emerald-900">
      <div className="relative w-16 h-16 flex items-center justify-center mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xl animate-pulse">🔐</span>
      </div>
      <p className="text-sm text-stone-500 font-bold tracking-wide">
        securing your nest...
      </p>
    </div>
  );
}
