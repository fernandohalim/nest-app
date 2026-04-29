"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { v4 as uuidv4 } from "uuid";
import { Expense, ExpenseItem, Member } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import ExpenseForm from "@/components/expense-form";
import CameraScanner from "@/components/camera-scanner";
import LoadingState from "@/components/loading-state";
import ScanningOverlay, { ScanStage } from "@/components/scanning-overlay";
import { getAvatarColor, getInitials } from "@/lib/avatars";

// 🔥 L5 helper (mirrors the one in app/trip/[id]/page.tsx). Keeping a copy here
// rather than exporting from a shared module — it's small enough that
// duplication is cheaper than figuring out where in the project a "scan-types"
// module should live. If we need a third copy in the future, that's the
// signal to extract it.
type ScanResponse = {
  items: Array<{ name: string; price: number }>;
  totalAmount?: number;
  merchantName?: string;
  date?: string;
  category?: string;
};

const isValidScanResponse = (data: unknown): data is ScanResponse => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.items)) return false;
  for (const item of d.items) {
    if (!item || typeof item !== "object") return false;
    const it = item as Record<string, unknown>;
    if (typeof it.name !== "string") return false;
    if (typeof it.price !== "number" || !isFinite(it.price)) return false;
  }
  return true;
};

function QuickSplitMemberModal({
  isOpen,
  onClose,
  members,
  setMembers,
  currentUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  setMembers: (m: Member[]) => void;
  currentUser: User | null;
}) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const showConfirm = useAlertStore((s) => s.showConfirm);

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
    setMembers([
      ...members,
      { id: uuidv4(), name: newMemberName.trim().toLowerCase() },
    ]);
    setNewMemberName("");
  };

  const handleRenameMember = (memberId: string) => {
    if (!editMemberName.trim()) return;
    setMembers(
      members.map((m) =>
        m.id === memberId
          ? { ...m, name: editMemberName.trim().toLowerCase() }
          : m,
      ),
    );
    setEditingMemberId(null);
  };

  // 🔥 U5 follow-through: severity is explicit, not inferred from title.
  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (memberId === currentUser?.id) {
      showAlert(
        "you can't remove yourself from your own receipt!",
        "nice try 😉",
      );
      return;
    }
    showConfirm(
      `are you sure you want to remove ${memberName} from this receipt?`,
      () => setMembers(members.filter((m) => m.id !== memberId)),
      {
        title: "remove friend? 👋",
        confirmText: "yes, remove them",
        severity: "destructive",
      },
    );
  };

  const closeAndReset = () => {
    onClose();
    setEditingMemberId(null);
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-modal-title"
    >
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeAndReset}
        aria-hidden="true"
      ></div>
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-stone-100">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50">
          <div>
            <h3
              id="member-modal-title"
              className="text-xl font-black text-stone-800"
            >
              manage crew 👥
            </h3>
            <p className="text-xs font-bold text-stone-400 mt-1">
              add, rename, or remove friends locally
            </p>
          </div>
          <button
            onClick={closeAndReset}
            aria-label="close"
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-stone-100 rounded-full text-stone-400 hover:text-stone-800 hover:border-stone-300 transition-all active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#fdfbf7]">
          {members.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div
                className="text-5xl mb-3 opacity-40 animate-bounce"
                aria-hidden="true"
              >
                👻
              </div>
              <p className="text-sm font-bold text-stone-400">
                it&apos;s a ghost town in here!
              </p>
              <p className="text-xs font-bold text-stone-300 mt-1">
                add some crew members below.
              </p>
            </div>
          ) : (
            members.map((member) => (
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
                      aria-label="rename member"
                      className="flex-1 bg-stone-50 border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameMember(member.id);
                        if (e.key === "Escape") setEditingMemberId(null);
                      }}
                    />
                    <button
                      onClick={() => handleRenameMember(member.id)}
                      aria-label="save rename"
                      className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                        aria-hidden="true"
                      >
                        {getInitials(member.name)}
                      </div>
                      <span className="font-extrabold text-stone-700">
                        {member.name}
                      </span>
                      {member.id === currentUser?.id && (
                        <span className="ml-1" aria-label="you">
                          👑
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingMemberId(member.id);
                          setEditMemberName(member.name);
                        }}
                        aria-label={`rename ${member.name}`}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-amber-100 hover:text-amber-600 transition-colors"
                      >
                        ✏️
                      </button>
                      {member.id !== currentUser?.id && (
                        <button
                          onClick={() =>
                            handleRemoveMember(member.id, member.name)
                          }
                          aria-label={`remove ${member.name}`}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
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
              aria-label="new member name"
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

function QuickSplitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const editId = searchParams.get("edit");

  // 🔥 L1: individual selectors
  const user = useTripStore((s) => s.user);
  const showAlert = useAlertStore((s) => s.showAlert);
  const showConfirm = useAlertStore((s) => s.showConfirm);

  const [members, setMembers] = useState<Member[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // 🔥 U12: stage-based progress instead of Math.random
  const [scanStage, setScanStage] = useState<ScanStage>("idle");
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(
    undefined,
  );
  const [showScanner, setShowScanner] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasOpenedScanner = useRef(false);

  useEffect(() => {
    if (user && members.length === 0 && !editId) {
      const fullName =
        user.user_metadata?.full_name || user.email?.split("@")[0] || "Me";
      setMembers([{ id: user.id, name: fullName.toLowerCase() }]);
    }
  }, [user, members.length, editId]);

  useEffect(() => {
    const fetchExistingExpense = async () => {
      if (!editId) return;
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", editId)
        .single();
      if (data && !error) {
        setMembers(data.ephemeral_members || []);
        setEditingExpense({
          id: data.id,
          title: data.title,
          totalAmount: data.total_amount,
          paidBy: data.paid_by || {},
          owedBy: data.owed_by || {},
          splitType: data.split_type || "equal",
          items: data.items || [],
          adjustments: data.adjustments || {},
          settledShares: data.settled_shares || {},
          expenseDate: data.expense_date,
          createdAt: data.created_at,
          category: data.category || "other",
        });
      }
    };
    fetchExistingExpense();
  }, [editId]);

  useEffect(() => {
    if (action === "scan" && !hasOpenedScanner.current && !editingExpense) {
      hasOpenedScanner.current = true;
      setShowScanner(true);
      router.replace("/quick-split");
    }
  }, [action, router, editingExpense]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const processReceiptFile = async (file: File) => {
    setScanStage("uploading");

    try {
      const base64Data = await fileToBase64(file);
      setScanStage("reading");

      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: base64Data, mimeType: file.type },
      });

      if (error || data?.error) throw new Error("failed to scan");

      // 🔥 L5: validate the Gemini response shape before trusting it
      if (!isValidScanResponse(data)) {
        throw new Error("invalid scan response shape");
      }

      setScanStage("extracting");

      const formattedItems: ExpenseItem[] = data.items.map((item) => ({
        id: uuidv4(),
        name: item.name,
        price: item.price,
        assignedTo: [],
      }));

      const totalScannedAmount =
        data.totalAmount ??
        formattedItems.reduce((sum, item) => sum + item.price, 0);

      const scannedExpense: Expense = {
        id: uuidv4(),
        title: data.merchantName
          ? `📝 ${data.merchantName}`
          : "📝 scanned receipt",
        totalAmount: totalScannedAmount,
        paidBy: { [user!.id]: totalScannedAmount },
        owedBy: {},
        splitType: "exact",
        items: formattedItems,
        expenseDate: data.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        category: data.category || "food & bev",
      };

      setEditingExpense(scannedExpense);
    } catch {
      showAlert(
        "couldn't read that receipt, try another one!",
        "scan failed ❌",
      );
    } finally {
      setScanStage("idle");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processReceiptFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveReceipt = async (expense: Expense) => {
    if (!user) {
      showAlert("you need to be signed in to save a receipt.", "uh oh 🔒");
      return;
    }

    try {
      const payload = {
        title: expense.title,
        total_amount: expense.totalAmount,
        paid_by: expense.paidBy,
        owed_by: expense.owedBy,
        split_type: expense.splitType,
        items: expense.items || null,
        adjustments: expense.adjustments || null,
        settled_shares: expense.settledShares || null,
        expense_date: expense.expenseDate,
        category: expense.category || "other",
        ephemeral_members: members,
      };

      if (editId) {
        // updates leave created_by alone — preserves the original creator
        await supabase.from("expenses").update(payload).eq("id", editId);
      } else {
        // 🔥 created_by is required for the receipts tab to find this row
        // (see app/page.tsx — the home page filters by created_by = user.id).
        // without this, new quick-splits would save successfully but
        // immediately disappear from the user's view.
        await supabase.from("expenses").insert({
          id: expense.id,
          trip_id: null,
          created_at: expense.createdAt,
          created_by: user.id,
          ...payload,
        });
      }

      showAlert("receipt saved perfectly to your dashboard!", "saved ✨");
      router.push(`/expense/${expense.id}?from=quick`);
    } catch (err) {
      console.error(err);
      showAlert("failed to save the receipt. please try again.", "error ❌");
    }
  };

  // 🔥 U9: confirm-on-back when there's an in-flight expense.
  //
  // Honest caveat: we can't see ExpenseForm's internal dirty state from here,
  // so this guard fires whenever there's a non-trivial editingExpense in
  // play. for a brand-new manual session (no editingExpense yet) the back
  // button stays instant, which feels right — there's nothing to lose. for
  // edit sessions and post-scan sessions, the user gets a confirm.
  const handleBack = () => {
    if (editingExpense) {
      showConfirm(
        "your changes haven't been saved. leave anyway?",
        () => router.push("/?tab=quick"),
        {
          title: "leave receipt? 👋",
          confirmText: "yes, discard",
          severity: "destructive",
        },
      );
    } else {
      router.push("/?tab=quick");
    }
  };

  const isWarmingUp = editId && !editingExpense;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-40 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        <div className="flex justify-between items-center mb-8 pt-4">
          <button
            onClick={handleBack}
            aria-label="back"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="text-sm font-black text-stone-400 uppercase tracking-widest">
            {editId ? "edit receipt ✏️" : "quick split ⚡"}
          </span>
          <div className="w-11 h-11" aria-hidden="true"></div>
        </div>

        {isWarmingUp ? (
          <div className="py-32">
            <LoadingState label="fetching receipt..." />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="mb-8">
              <div className="flex justify-between items-center mb-4 px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-stone-800">
                    crew 👯
                  </h2>
                </div>
                <button
                  onClick={() => setIsMemberModalOpen(true)}
                  className="group flex items-center gap-2.5 text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-stone-200 text-stone-600 rounded-xl hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all active:scale-95 shadow-sm"
                >
                  {members.length === 0 ? (
                    <span>add friend(s)</span>
                  ) : (
                    <>
                      <span className="flex items-center justify-center bg-stone-100 text-stone-500 min-w-5.5 h-5.5 px-1.5 rounded-lg group-hover:bg-stone-700 group-hover:text-stone-300 transition-colors">
                        {members.length}
                      </span>
                      <span>edit friend(s)</span>
                    </>
                  )}
                </button>
              </div>

              {members.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-stone-200 rounded-3xl text-center bg-white/50">
                  <p className="text-sm font-bold text-stone-400">
                    no members yet! add some friends to start splitting.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mb-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="pl-1.5 pr-4 py-1.5 bg-white border-2 border-stone-100 shadow-sm rounded-full text-sm font-bold flex items-center gap-2 hover:-translate-y-1 hover:shadow-md hover:border-emerald-200 transition-all cursor-default group"
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border transition-transform group-hover:scale-110 group-hover:rotate-6 ${getAvatarColor(member.name)}`}
                        aria-hidden="true"
                      >
                        {getInitials(member.name)}
                      </div>
                      <span className="text-stone-700">{member.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="relative">
              {!editingExpense &&
                !showScanner &&
                scanStage === "idle" &&
                !editId && (
                  <div className="flex flex-col gap-3 mb-6">
                    <button
                      onClick={() => setShowScanner(true)}
                      aria-label="scan a receipt"
                      className="w-full py-5 bg-stone-900 text-white rounded-3xl text-lg font-black hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/20 hover:shadow-emerald-600/30 active:scale-95 flex justify-center items-center gap-3"
                    >
                      <span className="text-2xl" aria-hidden="true">
                        📸
                      </span>{" "}
                      scan a receipt
                    </button>
                    <div className="text-center text-xs font-bold text-stone-400 py-2 uppercase tracking-widest">
                      — or type it manually —
                    </div>
                  </div>
                )}

              <ExpenseForm
                key={editingExpense?.id || (editId ? `edit-${editId}` : "new")}
                members={members}
                initialExpense={editingExpense}
                onSave={handleSaveReceipt}
                onCancel={() => router.push("/?tab=quick")}
                currencySymbol="Rp"
                currencyCode="IDR"
              />
            </div>
          </div>
        )}
      </div>

      <QuickSplitMemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        members={members}
        setMembers={setMembers}
        currentUser={user}
      />

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
      />

      {showScanner && (
        <CameraScanner
          onClose={() => {
            setShowScanner(false);
            if (!editingExpense && !editId) router.push("/?tab=quick");
          }}
          onUploadFallback={() => {
            setShowScanner(false);
            setTimeout(() => {
              fileInputRef.current?.click();
            }, 100);
          }}
          onCapture={(file) => {
            setShowScanner(false);
            processReceiptFile(file);
          }}
        />
      )}

      {/* 🔥 U12: honest stage-based scanning overlay (no Math.random) */}
      <ScanningOverlay stage={scanStage} />
    </main>
  );
}

export default function QuickSplitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdfbf7]">
          <LoadingState size="md" label={null} />
        </div>
      }
    >
      <QuickSplitContent />
    </Suspense>
  );
}
