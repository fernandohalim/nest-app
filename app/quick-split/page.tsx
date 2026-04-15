"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTripStore } from "@/store/useTripStore";
import { useAlertStore } from "@/store/useAlertStore";
import { v4 as uuidv4 } from "uuid";
import { Expense, ExpenseItem, Member } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js"; // 🔥 imported to replace "any"
import ExpenseForm from "@/components/expense-form";
import CameraScanner from "@/components/camera-scanner";

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

// 🔥 No more "any" keyword for currentUser!
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
      "remove friend? 👋",
      "yes, remove them",
    );
  };

  const closeAndReset = () => {
    onClose();
    setEditingMemberId(null);
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
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
              add, rename, or remove friends locally
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
          {members.length === 0 ? (
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
                      {member.id === currentUser?.id && (
                        <span className="ml-1">👑</span>
                      )}
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
                      {member.id !== currentUser?.id && (
                        <button
                          onClick={() =>
                            handleRemoveMember(member.id, member.name)
                          }
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

  const { user } = useTripStore();
  const showAlert = useAlertStore((state) => state.showAlert);

  const [members, setMembers] = useState<Member[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
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
    setScanProgress(0);
    setIsScanning(true);
    const progressInterval = setInterval(() => {
      setScanProgress((prev) =>
        prev >= 90 ? prev : prev + Math.floor(Math.random() * 15) + 5,
      );
    }, 300);

    try {
      const base64Data = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: base64Data, mimeType: file.type },
      });

      if (error || data?.error) throw new Error("failed to scan");

      const formattedItems: ExpenseItem[] = data.items.map(
        (item: { name: string; price: number }) => ({
          id: uuidv4(),
          name: item.name,
          price: item.price,
          assignedTo: [],
        }),
      );

      const totalScannedAmount =
        data.totalAmount ||
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

      clearInterval(progressInterval);
      setScanProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setEditingExpense(scannedExpense);
    } catch {
      clearInterval(progressInterval);
      showAlert(
        "couldn't read that receipt, try another one!",
        "scan failed ❌",
      );
    } finally {
      clearInterval(progressInterval);
      setIsScanning(false);
      setTimeout(() => setScanProgress(0), 300);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processReceiptFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveReceipt = async (expense: Expense) => {
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
        await supabase.from("expenses").update(payload).eq("id", editId);
      } else {
        await supabase.from("expenses").insert({
          id: expense.id,
          trip_id: null,
          created_at: expense.createdAt,
          ...payload,
        });
      }

      showAlert("receipt saved perfectly to your dashboard!", "saved ✨");
      // 🔥 directly pushes back to the unified expense page, but appends ?from=quick so it knows!
      router.push(`/expense/${expense.id}?from=quick`);
    } catch (err) {
      console.error(err);
      showAlert("failed to save the receipt. please try again.", "error ❌");
    }
  };

  const isWarmingUp = editId && !editingExpense;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-[#fdfbf7] pb-40 font-sans selection:bg-emerald-200 selection:text-emerald-900">
      <div className="w-full max-w-md relative">
        <div className="flex justify-between items-center mb-8 pt-4">
          <button
            // 🔥 if they cancel, push them strictly back to the home page's receipts tab
            onClick={() => router.push("/?tab=quick")}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-sm border border-stone-100 text-stone-500 hover:text-emerald-600 hover:scale-110 hover:-translate-y-0.5 active:scale-95 transition-all"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="text-sm font-black text-stone-400 uppercase tracking-widest">
            {editId ? "edit receipt ✏️" : "quick split ⚡"}
          </span>
          <div className="w-11 h-11"></div>
        </div>

        {isWarmingUp ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">
              fetching receipt...
            </span>
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
              {!editingExpense && !showScanner && !isScanning && !editId && (
                <div className="flex flex-col gap-3 mb-6">
                  <button
                    onClick={() => setShowScanner(true)}
                    className="w-full py-5 bg-stone-900 text-white rounded-3xl text-lg font-black hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/20 hover:shadow-emerald-600/30 active:scale-95 flex justify-center items-center gap-3"
                  >
                    <span className="text-2xl">📸</span> scan a receipt
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
                onCancel={() => router.push("/?tab=quick")} // 🔥 strictly push back to the receipts tab
                currencySymbol="Rp"
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

      {isScanning && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden">
            <div className="text-4xl relative z-10">📝</div>
            <div
              className="absolute left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] z-20"
              style={{ animation: "scan 1.5s ease-in-out infinite" }}
            >
              <style>{`@keyframes scan { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>
            </div>
          </div>
          <h3 className="text-xl font-black text-white tracking-wide mb-4">
            reading receipt...
          </h3>
          <div className="w-48 sm:w-64 bg-stone-800 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner border border-stone-700">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${scanProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <p className="text-emerald-400 font-black text-sm mb-1 tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
            {scanProgress}%
          </p>
          <p className="text-stone-400 font-bold text-xs mt-2 uppercase tracking-widest">
            letting gemini do the math
          </p>
        </div>
      )}
    </main>
  );
}

export default function QuickSplitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fdfbf7] text-stone-400 font-bold text-sm tracking-widest uppercase">
          warming up...
        </div>
      }
    >
      <QuickSplitContent />
    </Suspense>
  );
}
