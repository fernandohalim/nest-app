"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import NestLoader from "@/components/nest-loader";

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

  return <NestLoader message="securing your nest..." fullScreen />;
}
