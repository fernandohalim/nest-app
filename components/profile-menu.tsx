"use client";

import { supabase } from "@/lib/supabase";
import { useTripStore } from "@/store/useTripStore";
import Image from "next/image";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileMenu({ isOpen, onClose }: ProfileModalProps) {
  const { user } = useTripStore();

  if (!isOpen || !user) return null;

  // safely grab their google data
  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initial = fullName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0" onClick={onClose}></div>

      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
        {/* mobile drag indicator */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-stone-300 rounded-full sm:hidden z-20"></div>

        {/* header */}
        <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
          <h2 className="text-2xl font-black text-stone-800">
            your profile 👤
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-8 flex flex-col items-center gap-6">
          {/* giant avatar block */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-white border-4 border-stone-100 shadow-xl flex items-center justify-center overflow-hidden relative z-10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  width={112}
                  height={112}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-black text-stone-300">
                  {initial}
                </span>
              )}
            </div>
          </div>

          {/* user info */}
          <div className="text-center flex flex-col gap-1">
            <h3 className="text-2xl font-black text-stone-800 tracking-tight">
              {fullName}
            </h3>
            <p className="text-sm font-bold text-stone-400 tracking-wide bg-stone-100 px-4 py-1.5 rounded-full inline-block mx-auto border border-stone-200/50">
              {user.email}
            </p>
          </div>

          <div className="w-full border-t-2 border-dashed border-stone-200 mt-2 mb-2"></div>

          {/* sign out button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-rose-100 text-rose-500 p-4 rounded-2xl font-black text-base hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 active:scale-95 transition-all shadow-sm"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            sign out 👋
          </button>
        </div>
      </div>
    </div>
  );
}
