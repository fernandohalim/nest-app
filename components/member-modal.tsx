"use client";

import { useState } from "react";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { Trip } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => name.substring(0, 2).toLowerCase();

export default function MemberModal({
  isOpen,
  onClose,
  trip,
}: MemberModalProps) {
  const { addMember, updateMember, deleteMember } = useTripStore();
  const { showAlert, showConfirm } = useAlertStore();

  const [newMemberName, setNewMemberName] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");

  if (!isOpen) return null;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showAlert("you need to type a name first!", "whoops 😅");
      return;
    }
    addMember(trip.id, { id: uuidv4(), name: newMemberName.trim() });
    setNewMemberName("");
  };

  const handleRenameMember = async (memberId: string) => {
    if (!editMemberName.trim()) return;
    await updateMember(trip.id, memberId, editMemberName.trim());
    setEditingMemberId(null);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    const isTiedToExpense = trip.expenses.some(
      (exp) =>
        exp.paidBy[memberId] !== undefined ||
        exp.owedBy[memberId] !== undefined,
    );
    if (isTiedToExpense) {
      showAlert(
        `can't remove ${memberName} yet, they are part of an expense!`,
        "nope! 🙅‍♂️",
      );
      return;
    }

    showConfirm(
      `are you sure you want to remove ${memberName} from the trip?`,
      () => deleteMember(trip.id, memberId),
      "remove friend? 👋",
      "yes, remove them",
    );
  };

  const closeAndReset = () => {
    onClose();
    setEditingMemberId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeAndReset}
      ></div>
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-stone-100">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50">
          <div>
            <h3 className="text-xl font-black text-stone-800">
              manage crew 👥
            </h3>
            <p className="text-xs font-bold text-stone-400 mt-1">
              add, rename, or remove friends
            </p>
          </div>
          <button
            onClick={closeAndReset}
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-stone-100 rounded-full text-stone-400 hover:text-stone-800 hover:border-stone-300 transition-all active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#fdfbf7]">
          {trip.members.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-3 opacity-40 animate-bounce">👻</div>
              <p className="text-sm font-bold text-stone-400">
                it&apos;s a ghost town in here!
              </p>
              <p className="text-xs font-bold text-stone-300 mt-1">
                add some crew members below.
              </p>
            </div>
          ) : (
            trip.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-white p-3 border-2 border-stone-100 rounded-2xl shadow-sm hover:border-stone-200 transition-colors group"
              >
                {editingMemberId === member.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      autoFocus
                      value={editMemberName}
                      onChange={(e) => setEditMemberName(e.target.value)}
                      className="flex-1 bg-stone-50 border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameMember(member.id);
                        if (e.key === "Escape") setEditingMemberId(null);
                      }}
                    />
                    <button
                      onClick={() => handleRenameMember(member.id)}
                      className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border ${getAvatarColor(member.name)}`}
                      >
                        {getInitials(member.name)}
                      </div>
                      <span className="font-extrabold text-stone-700">
                        {member.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingMemberId(member.id);
                          setEditMemberName(member.name);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() =>
                          handleRemoveMember(member.id, member.name)
                        }
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 sm:p-5 bg-white border-t border-stone-100">
          <form onSubmit={handleAddMember} className="flex gap-2">
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="type a new name..."
              className="flex-1 bg-stone-50 border-2 border-stone-100 shadow-inner rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition-all placeholder:font-medium placeholder:text-stone-300"
            />
            <button
              type="submit"
              disabled={!newMemberName.trim()}
              className="px-6 py-3.5 bg-stone-900 text-white disabled:bg-stone-300 disabled:text-stone-500 hover:bg-emerald-600 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-95 disabled:active:scale-100 disabled:shadow-none"
            >
              add +
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
