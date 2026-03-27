"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTripStore } from "@/store/useTripStore";
import Image from "next/image";

export default function ProfileMenu() {
  const { user } = useTripStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // quietly close the menu if they click anywhere else on the screen
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  // safely grab their google data
  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName =
    user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
  const initial = fullName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // our AuthProvider wrapper will instantly notice this and kick them to /login!
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-full bg-stone-50 border-2 border-stone-100 flex items-center justify-center overflow-hidden hover:border-emerald-200 hover:shadow-md active:scale-95 transition-all shadow-sm group"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={44}
            height={44}
            unoptimized
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <span className="text-base font-black text-stone-500 group-hover:text-emerald-600 transition-colors">
            {initial}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-xl border-2 border-stone-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
          <div className="p-5 border-b-2 border-stone-100 bg-stone-50/50 flex flex-col gap-0.5">
            <p className="text-base font-black text-stone-800 truncate">
              {fullName}
            </p>
            <p className="text-[11px] font-bold text-stone-400 tracking-wider truncate">
              {user.email}
            </p>
          </div>
          <div className="p-2">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3.5 text-sm text-rose-500 font-bold hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all active:scale-[0.98] flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-full bg-rose-100/50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              sign out 👋
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
