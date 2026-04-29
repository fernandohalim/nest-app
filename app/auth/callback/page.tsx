"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoadingState from "@/components/loading-state";

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
      <LoadingState emoji="🔐" label="securing your nest..." />
    </div>
  );
}
