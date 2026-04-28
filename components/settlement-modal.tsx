"use client";

import { useState } from "react";
import { Transaction, Member } from "@/lib/types";
import { useAlertStore } from "@/store/useAlertStore";

// 🔥 1. Perfectly typed interface to replace 'any'
export interface MemberDetail {
  totalPaid: number;
  totalOwed: number;
  paidItems?: { title: string; amount: number; isNegative?: boolean }[];
  owedItems?: {
    title: string;
    amount: number;
    subItems?: string[];
    extra?: number;
    isSettled?: boolean;
    originalAmount?: number;
  }[];
}

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  memberDetails: Record<string, MemberDetail>; // 🔥 using the new type!
  settlements: Transaction[];
  currencySymbol?: string;
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

export default function SettlementModal({
  isOpen,
  onClose,
  members,
  memberDetails,
  settlements,
  currencySymbol = "Rp",
}: SettlementModalProps) {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const { showAlert } = useAlertStore();

  // 🔥 2. Sync state instantly without useEffect to avoid cascading renders!
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSelectedMember(null);
    }
  }

  if (!isOpen) return null;

  const handleShareProof = (resolutionText: string) => {
    navigator.clipboard.writeText(resolutionText);
    showAlert("copied! paste this in the group chat.", "proof copied 🔗");
  };

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:px-4">
      <div
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-[#fdfbf7] w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 pt-8 sm:pt-6 border-b-2 border-stone-100 flex justify-between items-center bg-white shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            {selectedMember && (
              <button
                onClick={() => setSelectedMember(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors"
              >
                ←
              </button>
            )}
            <h2 className="text-xl sm:text-2xl font-black text-stone-800">
              {selectedMember
                ? `${selectedMember.name}'s tab 🧾`
                : "verify my tab 🧾"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 hover:bg-rose-100 hover:text-rose-500 transition-all font-bold text-lg"
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {!selectedMember ? (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-stone-500 font-bold text-sm mb-4">
                who are you? tap your name to see your personal math.
              </h3>
              <div className="flex flex-col gap-3">
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-emerald-300 hover:shadow-md active:scale-[0.98] transition-all group"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black border-2 border-white shadow-sm ${getAvatarColor(member.name)}`}
                    >
                      {getInitials(member.name)}
                    </div>
                    <span className="font-extrabold text-lg text-stone-800 group-hover:text-emerald-700 transition-colors">
                      {member.name}
                    </span>
                    <div className="ml-auto text-stone-300 group-hover:text-emerald-400 transition-colors">
                      →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in slide-in-from-right-8 fade-in duration-300">
              {(() => {
                const details = memberDetails[selectedMember.id] || {
                  totalOwed: 0,
                  totalPaid: 0,
                };
                const balance = details.totalPaid - details.totalOwed;
                const isShort = balance < -0.01;
                const isOwed = balance > 0.01;
                const isEven = !isShort && !isOwed;

                const myPayments = settlements.filter(
                  (s) => s.from.id === selectedMember.id,
                );
                const myReceives = settlements.filter(
                  (s) => s.to.id === selectedMember.id,
                );

                return (
                  <div className="flex flex-col gap-6">
                    {/* 🔥 REVAMPED: Detailed Personal Breakdown (Consumed vs Paid) */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">
                        your detailed ledger
                      </span>
                      <div className="flex flex-col gap-3">
                        {/* Box 1: What they consumed (The Debt) */}
                        <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-4 flex flex-col gap-3 shadow-sm">
                          <div className="flex justify-between items-center border-b-2 border-dashed border-rose-200/60 pb-2">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                              🍔 consumed
                            </span>
                            <span className="font-black text-rose-600">
                              {currencySymbol}
                              {Number(details.totalOwed).toLocaleString(
                                "en-US",
                                { maximumFractionDigits: 2 },
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2.5">
                            {details.owedItems?.length === 0 ? (
                              <span className="text-xs text-rose-400 font-bold">
                                you didn&apos;t consume anything! 😇
                              </span>
                            ) : (
                              details.owedItems?.map((owed, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-1 text-xs text-rose-900/80 font-bold"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="leading-tight">
                                      {owed.title}
                                    </span>
                                    <span className="shrink-0 font-black">
                                      {currencySymbol}
                                      {Number(owed.amount).toLocaleString(
                                        "en-US",
                                        { maximumFractionDigits: 2 },
                                      )}
                                    </span>
                                  </div>
                                  {owed.subItems &&
                                    owed.subItems.length > 0 && (
                                      <div className="flex flex-col gap-0.5 mt-0.5">
                                        {owed.subItems.map((sub, sIdx) => {
                                          const [namePart, pricePart] =
                                            sub.split(" • ");
                                          return (
                                            <div
                                              key={sIdx}
                                              className="flex justify-between text-[10px] text-rose-700/60 pl-2 font-bold"
                                            >
                                              <span className="truncate">
                                                ↳ {namePart}
                                              </span>
                                              {pricePart && (
                                                <span>
                                                  {currencySymbol}
                                                  {pricePart}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Box 2: What they paid (The Credit) */}
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-4 flex flex-col gap-3 shadow-sm">
                          <div className="flex justify-between items-center border-b-2 border-dashed border-emerald-200/60 pb-2">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                              💳 paid upfront
                            </span>
                            <span className="font-black text-emerald-600">
                              {currencySymbol}
                              {Number(details.totalPaid).toLocaleString(
                                "en-US",
                                { maximumFractionDigits: 2 },
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2.5">
                            {!details.paidItems ||
                            details.paidItems.length === 0 ? (
                              <span className="text-xs text-emerald-400 font-bold">
                                didn&apos;t pay anything upfront! 😅
                              </span>
                            ) : (
                              details.paidItems?.map((paid, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-start gap-2 text-xs text-emerald-900/80 font-bold"
                                >
                                  <span className="leading-tight">
                                    {paid.title}
                                  </span>
                                  <span className="shrink-0 font-black">
                                    {currencySymbol}
                                    {Number(paid.amount).toLocaleString(
                                      "en-US",
                                      { maximumFractionDigits: 2 },
                                    )}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* The Personal Receipt */}
                    <div className="bg-white border-2 border-stone-100 rounded-3xl p-5 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                          total consumed
                        </span>
                        <span className="font-black text-rose-500">
                          {currencySymbol}{" "}
                          {Number(details.totalOwed).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                          paid upfront
                        </span>
                        <span className="font-black text-emerald-500">
                          {currencySymbol}{" "}
                          {Number(details.totalPaid).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="w-full border-t-2 border-dashed border-stone-200 mb-4"></div>

                      <div
                        className={`p-4 rounded-2xl border-2 flex items-center justify-between ${isShort ? "bg-rose-50 border-rose-100" : isOwed ? "bg-emerald-50 border-emerald-100" : "bg-stone-50 border-stone-200"}`}
                      >
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${isShort ? "text-rose-600" : isOwed ? "text-emerald-600" : "text-stone-500"}`}
                        >
                          {isShort
                            ? "you are short"
                            : isOwed
                              ? "you overpaid"
                              : "perfectly even"}
                        </span>
                        <span
                          className={`text-xl font-black ${isShort ? "text-rose-600" : isOwed ? "text-emerald-600" : "text-stone-600"}`}
                        >
                          {currencySymbol}{" "}
                          {Number(Math.abs(balance)).toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Resolution Section */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">
                        resolution
                      </span>

                      {isEven && (
                        <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 text-center">
                          <span className="text-2xl mb-2 block">🙌</span>
                          <span className="font-bold text-stone-600 text-sm">
                            you don&apos;t owe anyone, and no one owes you!
                          </span>
                        </div>
                      )}

                      {myPayments.map((payment, idx) => {
                        const proofText = `yo! for the trip tab, i consumed ${currencySymbol}${Number(details.totalOwed).toLocaleString()}, but only paid ${currencySymbol}${Number(details.totalPaid).toLocaleString()} upfront. so i owe you ${currencySymbol}${Number(payment.amount).toLocaleString()}! 💸`;
                        return (
                          <div
                            key={`pay-${idx}`}
                            className="bg-stone-900 p-5 rounded-3xl flex flex-col gap-3 shadow-xl"
                          >
                            <span className="font-extrabold text-white text-lg">
                              pay{" "}
                              <span className="text-emerald-400">
                                {payment.to.name}
                              </span>{" "}
                              {currencySymbol}
                              {Number(payment.amount).toLocaleString("en-US", {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <button
                              onClick={() => handleShareProof(proofText)}
                              className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10"
                            >
                              🔗 copy the proof
                            </button>
                          </div>
                        );
                      })}

                      {myReceives.map((receive, idx) => {
                        const proofText = `hey ${receive.from.name}! your total share for the trip was ${currencySymbol}${Number(memberDetails[receive.from.id]?.totalOwed || 0).toLocaleString()}, but you only paid ${currencySymbol}${Number(memberDetails[receive.from.id]?.totalPaid || 0).toLocaleString()} upfront. nest grouped the math, so you just need to venmo me ${currencySymbol}${Number(receive.amount).toLocaleString()}! 💸`;
                        return (
                          <div
                            key={`receive-${idx}`}
                            className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-3xl flex flex-col gap-3 shadow-sm"
                          >
                            <span className="font-extrabold text-emerald-800 text-lg">
                              collect{" "}
                              <span className="text-emerald-600">
                                {currencySymbol}
                                {Number(receive.amount).toLocaleString(
                                  "en-US",
                                  { maximumFractionDigits: 2 },
                                )}
                              </span>{" "}
                              from {receive.from.name}
                            </span>
                            <button
                              onClick={() => handleShareProof(proofText)}
                              className="w-full py-2.5 bg-emerald-200/50 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                              🔗 share the proof
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
