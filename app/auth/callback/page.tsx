"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // supabase automatically processes the secure URL codes in the background.
    // we just wait for the 'SIGNED_IN' event and route them to the dashboard!
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || session) {
          router.push("/");
        }
      },
    );

    // fallback just in case the event fired faster than the page rendered
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/");
    });

    return () => authListener.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm text-gray-500">securing your session...</p>
    </div>
  );
}
