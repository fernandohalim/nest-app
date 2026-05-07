"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { validateNickname, NICKNAME_MAX_LEN } from "@/lib/nickname";
import Image from "next/image";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileMenu({ isOpen, onClose }: ProfileModalProps) {
  const user = useTripStore((s) => s.user);
  const profile = useTripStore((s) => s.profile);
  const updateNickname = useTripStore((s) => s.updateNickname);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [isEditing, setIsEditing] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !user) return null;

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName =
    profile?.nickname ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initial = displayName.charAt(0).toUpperCase();

  const validation = validateNickname(nicknameInput);
  const isUnchanged = nicknameInput.trim() === (profile?.nickname || "");

  const startEditing = () => {
    setNicknameInput(profile?.nickname || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setNicknameInput("");
  };

  const saveNickname = async () => {
    const trimmed = nicknameInput.trim();
    const v = validateNickname(trimmed);
    if (!v.isValid) {
      showAlert(v.error || "invalid nickname", "hold up! 🛑");
      return;
    }
    if (trimmed === profile?.nickname) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await updateNickname(trimmed);
      showAlert("nickname updated! 🪪", "saved ✨");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showAlert("couldn't save your nickname. try again?", "error ❌");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0" onClick={onClose}></div>

      <div className="bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500 overflow-hidden relative pb-8 sm:pb-0">
        <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white z-10 shadow-sm">
          <h2 className="text-2xl font-black text-stone-800">
            your profile 👤
          </h2>
          <button
            onClick={onClose}
            aria-label="close"
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-200 active:scale-90 transition-all font-bold text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-white border-4 border-stone-100 shadow-xl flex items-center justify-center overflow-hidden relative z-10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
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

          <div className="text-center flex flex-col gap-2 w-full">
            {isEditing ? (
              <div className="flex flex-col gap-3 items-center w-full animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                  edit nickname
                </span>
                <input
                  type="text"
                  autoFocus
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  maxLength={NICKNAME_MAX_LEN + 5} // allow over-typing for clearer error
                  aria-label="nickname"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && validation.isValid && !isSaving) {
                      saveNickname();
                    }
                    if (e.key === "Escape") {
                      cancelEditing();
                    }
                  }}
                  className="w-full text-center bg-white border-2 border-stone-200 shadow-sm rounded-2xl px-4 py-3 text-xl font-extrabold text-stone-800 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all"
                />
                <div className="min-h-5 flex items-center justify-center">
                  {!validation.isValid && nicknameInput.length > 0 && (
                    <span className="text-[11px] font-bold text-rose-500">
                      {validation.error}
                    </span>
                  )}
                  {validation.isValid && !isUnchanged && (
                    <span className="text-[11px] font-bold text-emerald-500">
                      looks good ✨
                    </span>
                  )}
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="flex-1 py-3 bg-white border-2 border-stone-200 text-stone-500 rounded-xl font-black text-sm hover:bg-stone-50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    cancel
                  </button>
                  <button
                    onClick={saveNickname}
                    disabled={!validation.isValid || isUnchanged || isSaving}
                    className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-black text-sm hover:bg-emerald-600 active:scale-95 transition-all shadow-md disabled:bg-stone-300 disabled:shadow-none flex items-center justify-center"
                  >
                    {isSaving ? (
                      <div
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                        aria-hidden="true"
                      ></div>
                    ) : (
                      "save ✨"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 group">
                  <h3 className="text-2xl font-black text-stone-800 tracking-tight">
                    {displayName}
                  </h3>
                  <button
                    onClick={startEditing}
                    aria-label="edit nickname"
                    className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:bg-emerald-100 hover:text-emerald-600 active:scale-90 transition-all"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-sm font-bold text-stone-400 tracking-wide bg-stone-100 px-4 py-1.5 rounded-full inline-block mx-auto border border-stone-200/50">
                  {user.email}
                </p>
              </>
            )}
          </div>

          <div className="w-full border-t-2 border-dashed border-stone-200 mt-2 mb-2"></div>

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
