"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTripStore } from "@/store/useTripStore";

export default function Login() {
  const router = useRouter();
  const { user } = useTripStore();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#fdfbf7] relative overflow-hidden selection:bg-emerald-200 selection:text-emerald-900">
      {/* playful floating background elements */}
      <div className="absolute top-[15%] left-[10%] text-5xl opacity-40 -rotate-12 animate-[bounce_8s_ease-in-out_infinite]">
        🍔
      </div>
      <div className="absolute top-[20%] right-[15%] text-6xl opacity-30 rotate-12 animate-[bounce_9s_ease-in-out_infinite_reverse]">
        ✈️
      </div>
      <div className="absolute bottom-[25%] left-[20%] text-5xl opacity-40 rotate-45 animate-[bounce_7s_ease-in-out_infinite]">
        🏨
      </div>
      <div className="absolute bottom-[15%] right-[10%] text-6xl opacity-30 -rotate-12 animate-[bounce_10s_ease-in-out_infinite]">
        ☕
      </div>

      {/* magical blob glow behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/20 rounded-full blur-[100px] z-0 pointer-events-none"></div>

      <div className="w-full max-w-sm bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-900/5 border-2 border-stone-100 text-center relative z-10 animate-in zoom-in-95 duration-500">
        {/* logo icon */}
        <div className="w-16 h-16 bg-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 text-3xl shadow-lg shadow-emerald-600/30 transform -rotate-6 hover:rotate-0 transition-all duration-300">
          🐣
        </div>

        <h1 className="text-4xl font-black tracking-tight text-emerald-800 mb-3 drop-shadow-sm">
          nest.
        </h1>

        <p className="text-base font-bold text-stone-500 mb-10 leading-relaxed px-4">
          sign in to split the tab, save your trips, and keep the peace ✌️
        </p>

        <button
          onClick={handleGoogleLogin}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="w-full flex items-center justify-center gap-4 bg-white border-2 border-stone-200 text-stone-800 rounded-2xl p-4 font-black hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-[0.98] shadow-sm group"
        >
          <div
            className={`transition-transform duration-300 ${isHovered ? "scale-110 rotate-12" : ""}`}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          </div>
          continue with google
        </button>
      </div>
    </main>
  );
}
