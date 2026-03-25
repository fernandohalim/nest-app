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
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-black hover:ring-offset-2 transition-all shadow-sm"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={40}
            height={40}
            unoptimized
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-medium text-gray-600">{initial}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-900 truncate">
              {fullName}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {user.email}
            </p>
          </div>
          <div className="p-2">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
