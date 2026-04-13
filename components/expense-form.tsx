"use client";

import { useState } from "react";
import { Member, Expense } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { useAlertStore } from "@/store/useAlertStore";
import CustomSelect from "./custom-select";
import CustomDatePicker from "./custom-date-picker";

export interface ExpenseFormProps {
  members: Member[];
  initialExpense?: Expense;
  onSave: (expense: Expense) => void;
  onCancel: () => void;
  currencySymbol?: string;
}

const CATEGORIES = [
  { value: "food & bev", label: "🍔 food & bev" },
  { value: "shopping", label: "🛍️ shopping" },
  { value: "transportation", label: "⛽ transportation" },
  { value: "hotel", label: "🏨 hotel & stay" },
  { value: "flights", label: "✈️ flights" },
  { value: "activities", label: "🏄 activities" },
  { value: "other", label: "✨ other" },
];

const getLocalISOString = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:00`;
};

// 🔥 Bulletproof formatter for decimals
const formatNumber = (value: string | number | undefined) => {
  if (value === "" || value === null || value === undefined) return "";
  let strVal = value.toString();

  strVal = strVal.replace(/[^\d.]/g, "");
  const parts = strVal.split(".");

  let wholePart = parts[0];
  const decimalPart = parts.length > 1 ? "." + parts[1].substring(0, 2) : "";

  if (!wholePart && !decimalPart) return "";
  if (!wholePart) wholePart = "0";

  const formattedWhole = parseInt(wholePart, 10).toLocaleString("en-US");

  if (strVal.endsWith(".") && decimalPart === "") return formattedWhole + ".";

  return formattedWhole + decimalPart;
};

// 🔥 Bulletproof parser (prevents the crash you saw!)
const getRawNumber = (formattedValue: string | number | undefined) => {
  if (
    formattedValue === undefined ||
    formattedValue === null ||
    formattedValue === ""
  )
    return 0;
  const strVal = formattedValue.toString();
  const num = parseFloat(strVal.replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

// Local type to handle typing decimals
interface FormExpenseItem {
  id: string;
  name: string;
  priceInput: string;
  assignedTo: string[];
}

function useExpenseFormLogic(
  members: Member[],
  initialExpense: Expense | undefined,
  onSave: (expense: Expense) => void,
) {
  const showAlert = useAlertStore((state) => state.showAlert);

  const [title, setTitle] = useState(initialExpense?.title || "");
  const [amount, setAmount] = useState(
    initialExpense ? formatNumber(initialExpense.totalAmount) : "",
  );
  const [category, setCategory] = useState(
    initialExpense?.category || "food & bev",
  );
  const [expenseDate, setExpenseDate] = useState(
    initialExpense?.expenseDate || getLocalISOString(),
  );

  const [isMultiplePayers, setIsMultiplePayers] = useState(
    initialExpense ? Object.keys(initialExpense.paidBy).length > 1 : false,
  );
  const [payerId, setPayerId] = useState(
    initialExpense
      ? Object.keys(initialExpense.paidBy)[0]
      : members[0]?.id || "",
  );
  const [payers, setPayers] = useState<Record<string, string>>(
    initialExpense?.paidBy
      ? Object.entries(initialExpense.paidBy).reduce(
          (acc, [k, v]) => ({ ...acc, [k]: formatNumber(v) }),
          {},
        )
      : {},
  );

  const [splitType, setSplitType] = useState<"equal" | "exact" | "adjustment">(
    initialExpense?.splitType || "equal",
  );

  const [involvedIds, setInvolvedIds] = useState<string[]>(
    initialExpense?.splitType === "equal" ||
      initialExpense?.splitType === "adjustment"
      ? Object.keys(initialExpense.owedBy).filter((id) => {
          if (initialExpense.splitType === "adjustment") {
            const extra = initialExpense.adjustments?.[id] || 0;
            return initialExpense.owedBy[id] > extra;
          }
          return true;
        })
      : members.map((m) => m.id),
  );

  const [adjustments, setAdjustments] = useState<Record<string, string>>(
    initialExpense?.adjustments
      ? Object.entries(initialExpense.adjustments).reduce(
          (acc, [k, v]) => ({ ...acc, [k]: formatNumber(v) }),
          {},
        )
      : {},
  );

  // Initialize items with the new priceInput string
  const [items, setItems] = useState<FormExpenseItem[]>(
    initialExpense?.items
      ? initialExpense.items.map((i) => ({
          id: i.id,
          name: i.name,
          priceInput: i.price ? formatNumber(i.price) : "",
          assignedTo: i.assignedTo,
        }))
      : [{ id: uuidv4(), name: "", priceInput: "", assignedTo: [] }],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmount(formatNumber(e.target.value));
  const handlePayerChange = (id: string, val: string) =>
    setPayers((prev) => ({ ...prev, [id]: formatNumber(val) }));
  const handleAdjustmentChange = (id: string, val: string) =>
    setAdjustments((prev) => ({ ...prev, [id]: formatNumber(val) }));
  const toggleInvolved = (id: string) =>
    setInvolvedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  const handleAddItem = () =>
    setItems([
      ...items,
      { id: uuidv4(), name: "", priceInput: "", assignedTo: [] },
    ]);

  const handleRemoveItem = (id: string) =>
    setItems(items.filter((item) => item.id !== id));

  const handleItemChange = (
    id: string,
    field: "name" | "priceInput",
    value: string,
  ) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          if (field === "priceInput")
            return { ...item, priceInput: formatNumber(value) };
          return { ...item, name: value };
        }
        return item;
      }),
    );
  };

  const increaseItemMemberWeight = (itemId: string, memberId: string) => {
    setItems(
      items.map((item) => {
        if (item.id === itemId)
          return { ...item, assignedTo: [...item.assignedTo, memberId] };
        return item;
      }),
    );
  };

  const decreaseItemMemberWeight = (itemId: string, memberId: string) => {
    setItems(
      items.map((item) => {
        if (item.id === itemId) {
          const index = item.assignedTo.indexOf(memberId);
          if (index > -1) {
            const newAssignedTo = [...item.assignedTo];
            newAssignedTo.splice(index, 1);
            return { ...item, assignedTo: newAssignedTo };
          }
        }
        return item;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmountNum = getRawNumber(amount);

    if (!title.trim()) {
      showAlert("what are we paying for? give it a name!", "missing title! 📝");
      return;
    }
    if (totalAmountNum <= 0) {
      showAlert(
        "you can't split zero dollars! enter a valid amount.",
        "hold up! 🛑",
      );
      return;
    }

    let finalPaidBy: Record<string, number> = {};
    if (isMultiplePayers) {
      let sumPaid = 0;
      Object.entries(payers).forEach(([id, val]) => {
        const num = getRawNumber(val);
        if (num > 0) {
          finalPaidBy[id] = num;
          sumPaid += num;
        }
      });
      if (sumPaid !== totalAmountNum) {
        showAlert(
          `payments must equal ${totalAmountNum.toLocaleString()}`,
          "math error 🧮",
        );
        return;
      }
      if (Object.keys(finalPaidBy).length === 0) {
        showAlert(
          "somebody had to pay for this! who was it?",
          "missing payer! 💳",
        );
        return;
      }
    } else {
      if (!payerId) {
        showAlert("select who paid the bill!", "missing payer! 💳");
        return;
      }
      finalPaidBy = { [payerId]: totalAmountNum };
    }

    const owedBy: Record<string, number> = {};
    const savedAdjustments: Record<string, number> = {};

    if (splitType === "equal") {
      if (involvedIds.length === 0) {
        showAlert(
          "select at least one person to split this with.",
          "lonely expense! 🧍",
        );
        return;
      }
      const splitAmount = totalAmountNum / involvedIds.length;
      involvedIds.forEach((id) => {
        owedBy[id] = splitAmount;
      });
    } else if (splitType === "exact") {
      const validItems = items
        .map((i) => ({
          id: i.id,
          name: i.name,
          price: getRawNumber(i.priceInput),
          assignedTo: i.assignedTo,
        }))
        .filter((i) => i.name.trim() !== "" && i.price > 0);

      if (validItems.length === 0) {
        showAlert(
          "add at least one item with a price to split it exactly.",
          "no items! 🛒",
        );
        return;
      }
      const unassignedItems = validItems.filter(
        (i) => i.assignedTo.length === 0,
      );
      if (unassignedItems.length > 0) {
        showAlert(
          `who had the "${unassignedItems[0].name}"? assign it to someone!`,
          "unclaimed item! 🕵️",
        );
        return;
      }

      const sumOfItems = validItems.reduce((acc, item) => acc + item.price, 0);
      const ratio = totalAmountNum / sumOfItems;

      validItems.forEach((item) => {
        const splitPrice = item.price / item.assignedTo.length;
        item.assignedTo.forEach((memberId) => {
          owedBy[memberId] = (owedBy[memberId] || 0) + splitPrice * ratio;
        });
      });
    } else if (splitType === "adjustment") {
      let sumAdjustments = 0;
      Object.entries(adjustments).forEach(([id, val]) => {
        const num = getRawNumber(val);
        if (num > 0) {
          savedAdjustments[id] = num;
          sumAdjustments += num;
        }
      });

      if (sumAdjustments > totalAmountNum) {
        showAlert(
          "the extra adjustments can't be higher than the actual bill!",
          "math error 🧮",
        );
        return;
      }
      const remainingToSplit = totalAmountNum - sumAdjustments;
      const splitAmount =
        involvedIds.length > 0 ? remainingToSplit / involvedIds.length : 0;

      involvedIds.forEach((id) => {
        owedBy[id] = splitAmount + (savedAdjustments[id] || 0);
      });
      Object.entries(savedAdjustments).forEach(([id, val]) => {
        if (!involvedIds.includes(id)) owedBy[id] = val;
      });
      if (Object.keys(owedBy).length === 0) {
        showAlert("setup the split amounts before saving!", "empty split! 🍕");
        return;
      }
    }

    setIsSubmitting(true);
    await onSave({
      id: initialExpense?.id || uuidv4(),
      title,
      totalAmount: totalAmountNum,
      paidBy: finalPaidBy,
      owedBy,
      splitType,
      items:
        splitType === "exact"
          ? items
              .map((i) => ({
                id: i.id,
                name: i.name,
                price: getRawNumber(i.priceInput),
                assignedTo: i.assignedTo,
              }))
              .filter((i) => i.name.trim() !== "" && i.price > 0)
          : undefined,
      adjustments: splitType === "adjustment" ? savedAdjustments : undefined,
      settledShares: initialExpense?.settledShares,
      expenseDate: new Date(expenseDate).toISOString(),
      createdAt: initialExpense?.createdAt || new Date().toISOString(),
      category,
    });
  };

  const totalAmountNum = getRawNumber(amount);
  const currentPaidSum = Object.values(payers).reduce(
    (sum, val) => sum + getRawNumber(val),
    0,
  );
  const mathDiff = totalAmountNum - currentPaidSum;
  const itemsSum = items.reduce(
    (acc, item) => acc + getRawNumber(item.priceInput),
    0,
  );
  const difference = totalAmountNum - itemsSum;

  return {
    title,
    setTitle,
    amount,
    handleAmountChange,
    category,
    setCategory,
    expenseDate,
    setExpenseDate,
    isMultiplePayers,
    setIsMultiplePayers,
    payerId,
    setPayerId,
    payers,
    handlePayerChange,
    splitType,
    setSplitType,
    involvedIds,
    toggleInvolved,
    adjustments,
    handleAdjustmentChange,
    items,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    increaseItemMemberWeight,
    decreaseItemMemberWeight,
    isSubmitting,
    handleSubmit,
    totalAmountNum,
    mathDiff,
    itemsSum,
    difference,
  };
}

export default function ExpenseForm({
  members,
  initialExpense,
  onSave,
  onCancel,
  currencySymbol = "Rp",
}: ExpenseFormProps) {
  const {
    title,
    setTitle,
    amount,
    handleAmountChange,
    category,
    setCategory,
    expenseDate,
    setExpenseDate,
    isMultiplePayers,
    setIsMultiplePayers,
    payerId,
    setPayerId,
    payers,
    handlePayerChange,
    splitType,
    setSplitType,
    involvedIds,
    toggleInvolved,
    adjustments,
    handleAdjustmentChange,
    items,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    increaseItemMemberWeight,
    decreaseItemMemberWeight,
    isSubmitting,
    handleSubmit,
    totalAmountNum,
    mathDiff,
    itemsSum,
    difference,
  } = useExpenseFormLogic(members, initialExpense, onSave);

  const newLocal =
    "flex-[2] py-4.5 bg-stone-900 text-white rounded-2xl text-base font-black hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/20 hover:shadow-emerald-600/30 active:scale-95 disabled:bg-stone-300 disabled:shadow-none flex justify-center items-center";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Hero Inputs */}
      <div className="flex flex-col gap-5 p-2">
        <input
          type="text"
          placeholder="expense name (?)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-3xl font-black bg-transparent border-none placeholder:text-stone-300 focus:outline-none text-stone-800 transition-all focus:scale-[1.02] transform origin-left"
          autoFocus
        />
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black text-stone-300">
            {currencySymbol}
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={handleAmountChange}
            className="w-full text-5xl font-black bg-transparent border-none placeholder:text-stone-300 focus:outline-none text-emerald-600 transition-all focus:scale-[1.02] transform origin-left"
          />
        </div>
      </div>

      {/* Meta details */}
      <div className="flex gap-3 mt-2">
        <div className="flex-1 relative">
          <label className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-black text-stone-400 uppercase tracking-widest z-10 pointer-events-none">
            date
          </label>
          <CustomDatePicker
            value={expenseDate}
            onChange={(val) => setExpenseDate(val)}
            className="w-full"
          />
        </div>

        <div className="flex-1 relative">
          <label className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-black text-stone-400 uppercase tracking-widest z-10 pointer-events-none">
            type
          </label>
          <CustomSelect
            value={category}
            onChange={(val) => setCategory(val)}
            options={CATEGORIES}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Payer Section */}
      <div className="bg-white rounded-3xl p-5 border-2 border-stone-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-black text-stone-800 uppercase tracking-wide">
            who paid? 💳
          </span>
          <button
            type="button"
            onClick={() => setIsMultiplePayers(!isMultiplePayers)}
            className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 px-3 py-1.5 rounded-xl transition-all active:scale-95"
          >
            {isMultiplePayers ? "switch to one person" : "multiple people"}
          </button>
        </div>

        {!isMultiplePayers ? (
          <CustomSelect
            value={payerId}
            onChange={(val) => setPayerId(val)}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
            className="w-full"
          />
        ) : (
          <div className="space-y-3 animate-in fade-in duration-300">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex justify-between items-center bg-stone-50 p-3.5 rounded-2xl border-2 border-stone-100 focus-within:border-emerald-400 focus-within:bg-white transition-all"
              >
                <span className="text-sm font-bold text-stone-700">
                  {m.name}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={payers[m.id] || ""}
                  onChange={(e) => handlePayerChange(m.id, e.target.value)}
                  className="w-24 text-right bg-transparent border-b-2 border-stone-200 text-base font-black text-emerald-600 focus:outline-none focus:border-emerald-500 py-1"
                />
              </div>
            ))}

            {/* Multiple Payers Math Helper */}
            <div className="mt-4 pt-4 border-t-2 border-dashed border-stone-100">
              {totalAmountNum === 0 ? (
                <p className="text-[11px] font-bold text-stone-400 text-center py-2">
                  enter a total amount above first! 👆
                </p>
              ) : mathDiff === 0 ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 py-2.5 rounded-xl animate-in zoom-in-95 duration-300">
                  <span className="text-lg">✨</span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    perfectly matches total!
                  </span>
                </div>
              ) : mathDiff > 0 ? (
                <div className="flex items-center justify-between text-amber-600 bg-amber-50 px-4 py-2.5 rounded-xl transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    left to assign:
                  </span>
                  <span className="text-sm font-black">
                    {currencySymbol}{" "}
                    {Number(mathDiff).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-rose-600 bg-rose-50 px-4 py-2.5 rounded-xl transition-colors animate-pulse">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    overpaid by:
                  </span>
                  <span className="text-sm font-black">
                    {currencySymbol}{" "}
                    {Number(Math.abs(mathDiff)).toLocaleString("en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Split logic */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-black text-stone-800 uppercase tracking-wide">
              how are we splitting? 🍕
            </span>
          </div>

          <div className="bg-stone-100 p-1.5 rounded-3xl flex gap-1 relative overflow-hidden">
            <div
              className={`absolute top-1.5 bottom-1.5 w-[32%] bg-white rounded-2xl shadow-sm transition-all duration-300 ease-out ${splitType === "equal" ? "left-[1.5%]" : splitType === "exact" ? "left-[34%]" : "left-[66.5%]"}`}
            ></div>
            <button
              type="button"
              onClick={() => setSplitType("equal")}
              className={`flex-1 py-3 text-xs z-10 rounded-2xl transition-all active:scale-95 ${splitType === "equal" ? "font-black text-stone-800" : "font-bold text-stone-500 hover:text-stone-700"}`}
            >
              equally
            </button>
            <button
              type="button"
              onClick={() => setSplitType("exact")}
              className={`flex-1 py-3 text-xs z-10 rounded-2xl transition-all active:scale-95 ${splitType === "exact" ? "font-black text-stone-800" : "font-bold text-stone-500 hover:text-stone-700"}`}
            >
              by item
            </button>
            <button
              type="button"
              onClick={() => setSplitType("adjustment")}
              className={`flex-1 py-3 text-xs z-10 rounded-2xl transition-all active:scale-95 ${splitType === "adjustment" ? "font-black text-stone-800" : "font-bold text-stone-500 hover:text-stone-700"}`}
            >
              custom
            </button>
          </div>

          <div className="px-2 min-h-5">
            <p
              key={splitType}
              className="text-[11px] font-bold text-stone-400 animate-in fade-in slide-in-from-top-1 duration-300"
            >
              {splitType === "equal" &&
                "the total is divided perfectly evenly among everyone selected."}
              {splitType === "exact" &&
                "assign specific receipt items to people. (tips/tax are auto-calculated!)"}
              {splitType === "adjustment" &&
                "split equally, but add specific extra amounts for certain people."}
            </p>
          </div>
        </div>

        {(splitType === "equal" || splitType === "adjustment") && (
          <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-300">
            {members.map((m) => {
              const isTicked = involvedIds.includes(m.id);
              const hasAdjustment = !!adjustments[m.id];

              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${isTicked ? "bg-white border-emerald-400 shadow-sm" : hasAdjustment ? "bg-white border-stone-300 shadow-sm" : "bg-stone-50 border-stone-100 opacity-60 hover:opacity-100"}`}
                  onClick={() => toggleInvolved(m.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${isTicked ? "bg-emerald-500 border-emerald-500 text-white scale-110" : "border-stone-300 bg-white"}`}
                    >
                      {isTicked && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold ${isTicked || hasAdjustment ? "text-stone-800" : "text-stone-500"}`}
                    >
                      {m.name}
                    </span>
                  </div>

                  {splitType === "adjustment" && (
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="+ extra"
                      value={adjustments[m.id] || ""}
                      onChange={(e) =>
                        handleAdjustmentChange(m.id, e.target.value)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className={`w-20 text-right bg-transparent border-b-2 text-sm font-black focus:outline-none py-1 placeholder:font-bold transition-colors ${isTicked ? "border-emerald-100 text-emerald-600 focus:border-emerald-500 placeholder:text-emerald-200" : "border-stone-200 text-stone-600 focus:border-stone-400 placeholder:text-stone-300"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {splitType === "exact" && (
          <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in zoom-in-95 duration-500 delay-150">
              <span className="text-xl">✨</span>
              <p className="text-[11px] font-bold text-emerald-700 leading-snug">
                <span className="font-black">pro tip:</span> tap a name multiple
                times to give them a larger share! (great for when someone eats
                3 slices of pizza 🍕)
              </p>
            </div>

            {items.map((item) => {
              const isOrphaned =
                item.name.trim() !== "" &&
                getRawNumber(item.priceInput) > 0 &&
                item.assignedTo.length === 0;

              return (
                <div
                  key={item.id}
                  className={`border-2 rounded-3xl bg-white shadow-sm flex flex-col group overflow-hidden transition-colors duration-300 ${isOrphaned ? "border-rose-100 shadow-rose-100" : "border-stone-100"}`}
                >
                  {/* Inputs Row */}
                  <div
                    className={`flex items-center w-full border-b-2 transition-colors duration-300 ${isOrphaned ? "bg-rose-50/30 border-rose-100" : "bg-stone-50 border-stone-100"}`}
                  >
                    <input
                      type="text"
                      placeholder="what is it?"
                      value={item.name}
                      onChange={(e) =>
                        handleItemChange(item.id, "name", e.target.value)
                      }
                      className={`flex-6 min-w-0 text-sm font-black bg-transparent px-4 py-3 sm:py-4 focus:outline-none focus:bg-white transition-all border-r-2 ${isOrphaned ? "border-rose-100" : "border-stone-100"}`}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="price"
                      value={item.priceInput}
                      onChange={(e) =>
                        handleItemChange(item.id, "priceInput", e.target.value)
                      }
                      className={`flex-4 min-w-0 text-sm font-black text-right bg-transparent px-3 py-3 sm:py-4 focus:outline-none focus:bg-white transition-all text-emerald-600 border-r-2 ${isOrphaned ? "border-rose-100" : "border-stone-100"}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-10 sm:w-12 shrink-0 flex items-center justify-center self-stretch bg-transparent text-stone-400 hover:bg-rose-500 hover:text-white transition-all font-black text-lg"
                    >
                      ×
                    </button>
                  </div>

                  {/* member tag row */}
                  <div className="flex flex-col px-3 py-3 sm:px-4 sm:py-3 bg-white">
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {members.map((m) => {
                        const weight = item.assignedTo.filter(
                          (id) => id === m.id,
                        ).length;
                        const isAssigned = weight > 0;

                        if (isAssigned) {
                          return (
                            <div
                              key={m.id}
                              className="flex items-stretch bg-stone-800 text-white rounded-full shadow-md shadow-stone-800/20 -translate-y-px overflow-hidden transition-all"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  increaseItemMemberWeight(item.id, m.id)
                                }
                                className="text-[10px] sm:text-[11px] font-black pl-3.5 sm:pl-4 pr-2 py-1.5 sm:py-2 transition-colors hover:bg-stone-700 active:bg-stone-600 flex items-center gap-1.5"
                              >
                                {m.name}
                                {weight > 1 && (
                                  <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded-md text-[9px] font-black leading-none flex items-center">
                                    x{weight}
                                  </span>
                                )}
                              </button>
                              <div className="w-px bg-stone-600 my-1"></div>
                              <button
                                type="button"
                                onClick={() =>
                                  decreaseItemMemberWeight(item.id, m.id)
                                }
                                className="px-2 hover:bg-rose-500 hover:text-white text-stone-300 transition-colors active:bg-rose-600 flex items-center justify-center"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M20 12H4"
                                  />
                                </svg>
                              </button>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              increaseItemMemberWeight(item.id, m.id)
                            }
                            className="text-[10px] sm:text-[11px] font-black px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all active:scale-90 bg-stone-50 text-stone-400 border-2 border-stone-100 hover:bg-stone-200"
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                    {isOrphaned && (
                      <span className="text-[10px] font-bold text-rose-500 mt-2 ml-1 animate-in fade-in duration-300">
                        ↑ tap a name to assign this item!
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3.5 sm:py-4 text-sm font-black text-stone-500 bg-stone-100 hover:bg-emerald-100 hover:text-emerald-700 rounded-4xl transition-all active:scale-95 border-2 border-dashed border-stone-300 hover:border-emerald-300"
            >
              + add another item
            </button>
          </div>
        )}

        {/* exact sum warning */}
        {splitType === "exact" && itemsSum > 0 && difference !== 0 && (
          <div className="p-5 bg-amber-50 border-2 border-amber-100 rounded-3xl text-sm font-bold text-amber-800 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-2xl leading-none">💡</span>
            <p className="leading-tight">
              subtotal is{" "}
              <span className="font-black">
                {currencySymbol}{" "}
                {Number(itemsSum).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </span>
              . the extra{" "}
              <span className="font-black">
                {currencySymbol}{" "}
                {Number(Math.abs(difference)).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </span>{" "}
              {difference > 0 ? "tax/tip" : "discount"} will be split fairly
              across the items.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4.5 bg-white border-2 border-stone-200 text-stone-500 rounded-2xl text-base font-black hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95"
        >
          cancel
        </button>
        <button type="submit" disabled={isSubmitting} className={newLocal}>
          {isSubmitting ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : initialExpense ? (
            "save changes ✨"
          ) : (
            "add to expense list 🚀"
          )}
        </button>
      </div>
    </form>
  );
}
