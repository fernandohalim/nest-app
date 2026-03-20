"use client";

import { useState } from "react";
import { Member, Expense, ExpenseItem } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

interface ExpenseFormProps {
  members: Member[];
  initialExpense?: Expense;
  onSave: (expense: Expense) => void;
  onCancel: () => void;
}

export default function ExpenseForm({ members, initialExpense, onSave, onCancel }: ExpenseFormProps) {
  const formatNumber = (value: string | number) => {
    if (!value) return "";
    const numericOnly = value.toString().replace(/\D/g, "");
    if (!numericOnly) return "";
    return parseInt(numericOnly, 10).toLocaleString("en-US");
  };

  const getRawNumber = (formattedValue: string) => {
    return parseInt(formattedValue.replace(/,/g, ""), 10) || 0;
  };

  const [title, setTitle] = useState(initialExpense?.title || "");
  const [amount, setAmount] = useState(initialExpense ? formatNumber(initialExpense.totalAmount) : ""); 
  
  // --- NEW MULTI-PAYER STATE ---
  const [isMultiplePayers, setIsMultiplePayers] = useState(
    initialExpense ? Object.keys(initialExpense.paidBy).length > 1 : false
  );
  const [payerId, setPayerId] = useState(initialExpense ? Object.keys(initialExpense.paidBy)[0] : members[0]?.id || "");
  const [payers, setPayers] = useState<Record<string, string>>(
    initialExpense?.paidBy
      ? Object.entries(initialExpense.paidBy).reduce((acc, [k, v]) => ({ ...acc, [k]: formatNumber(v) }), {})
      : {}
  );

  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'adjustment'>(initialExpense?.splitType || 'equal');
  
  const [involvedIds, setInvolvedIds] = useState<string[]>(
    initialExpense?.splitType === 'equal' || initialExpense?.splitType === 'adjustment'
      ? Object.keys(initialExpense.owedBy).filter(id => {
          if (initialExpense.splitType === 'adjustment') {
             const extra = initialExpense.adjustments?.[id] || 0;
             return initialExpense.owedBy[id] > extra;
          }
          return true;
        })
      : members.map(m => m.id)
  );
  
  const [adjustments, setAdjustments] = useState<Record<string, string>>(
    initialExpense?.adjustments
      ? Object.entries(initialExpense.adjustments).reduce((acc, [k, v]) => ({ ...acc, [k]: formatNumber(v) }), {})
      : {}
  );

  const [items, setItems] = useState<ExpenseItem[]>(
    initialExpense?.items || [{ id: uuidv4(), name: "", price: 0, assignedTo: [] }]
  );

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => setAmount(formatNumber(e.target.value));
  const handlePayerChange = (id: string, val: string) => setPayers(prev => ({ ...prev, [id]: formatNumber(val) }));
  const handleAdjustmentChange = (id: string, val: string) => setAdjustments(prev => ({ ...prev, [id]: formatNumber(val) }));
  const toggleInvolved = (id: string) => setInvolvedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleAddItem = () => setItems([...items, { id: uuidv4(), name: "", price: 0, assignedTo: [] }]);
  const handleRemoveItem = (id: string) => setItems(items.filter(item => item.id !== id));
  
  const handleItemChange = (id: string, field: 'name' | 'price', value: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (field === 'price') return { ...item, price: getRawNumber(value) };
        return { ...item, name: value };
      }
      return item;
    }));
  };

  const toggleItemMember = (itemId: string, memberId: string) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        const isAssigned = item.assignedTo.includes(memberId);
        return { ...item, assignedTo: isAssigned ? item.assignedTo.filter(id => id !== memberId) : [...item.assignedTo, memberId] };
      }
      return item;
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmountNum = getRawNumber(amount);

    if (!title.trim()) return alert("please enter a title for the expense.");
    if (totalAmountNum <= 0) return alert("please enter a valid total amount.");

    // --- process multiple payers ---
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
        return alert(`the combined payments (${sumPaid.toLocaleString()}) must exactly equal the total bill (${totalAmountNum.toLocaleString()}).`);
      }
      if (Object.keys(finalPaidBy).length === 0) return alert("please enter who paid what.");
    } else {
      if (!payerId) return alert("please select who paid.");
      finalPaidBy = { [payerId]: totalAmountNum };
    }

    let owedBy: Record<string, number> = {};
    let savedAdjustments: Record<string, number> = {};

    if (splitType === 'equal') {
      if (involvedIds.length === 0) return alert("select at least one person to split with.");
      const splitAmount = totalAmountNum / involvedIds.length;
      involvedIds.forEach(id => { owedBy[id] = splitAmount; });
      
    } else if (splitType === 'exact') {
      const validItems = items.filter(i => i.name.trim() !== "" && i.price > 0);
      if (validItems.length === 0) return alert("please enter at least one valid item with a price.");
      
      const unassignedItems = validItems.filter(i => i.assignedTo.length === 0);
      if (unassignedItems.length > 0) return alert(`please assign who had the "${unassignedItems[0].name}".`);

      let sumOfItems = validItems.reduce((acc, item) => acc + item.price, 0);
      const ratio = totalAmountNum / sumOfItems; 

      validItems.forEach(item => {
        const splitPrice = item.price / item.assignedTo.length;
        item.assignedTo.forEach(memberId => {
          owedBy[memberId] = (owedBy[memberId] || 0) + (splitPrice * ratio);
        });
      });

    } else if (splitType === 'adjustment') {
      let sumAdjustments = 0;
      Object.entries(adjustments).forEach(([id, val]) => {
        const num = getRawNumber(val);
        if (num > 0) {
          savedAdjustments[id] = num;
          sumAdjustments += num;
        }
      });

      if (sumAdjustments > totalAmountNum) return alert("the extra adjustments cannot be higher than the total bill!");
      const remainingToSplit = totalAmountNum - sumAdjustments;
      const splitAmount = involvedIds.length > 0 ? remainingToSplit / involvedIds.length : 0;

      involvedIds.forEach(id => { owedBy[id] = splitAmount + (savedAdjustments[id] || 0); });
      Object.entries(savedAdjustments).forEach(([id, val]) => {
        if (!involvedIds.includes(id)) owedBy[id] = val;
      });

      if (Object.keys(owedBy).length === 0) return alert("please configure the split.");
    }

    onSave({
      id: initialExpense?.id || uuidv4(),
      title,
      totalAmount: totalAmountNum,
      paidBy: finalPaidBy,
      owedBy,
      splitType,
      items: splitType === 'exact' ? items.filter(i => i.name.trim() !== "" && i.price > 0) : undefined,
      adjustments: splitType === 'adjustment' ? savedAdjustments : undefined,
      settledShares: initialExpense?.settledShares
    });
  };

  const currentTotal = getRawNumber(amount);
  const itemsSum = items.reduce((acc, item) => acc + item.price, 0);
  const difference = currentTotal - itemsSum;

  let adjSum = 0;
  Object.values(adjustments).forEach(v => adjSum += getRawNumber(v));
  const remainingAfterAdj = currentTotal - adjSum;

  return (
    <form onSubmit={handleSubmit} className="p-5 border border-gray-200 rounded-2xl bg-white space-y-5 shadow-sm">
      <div className="flex gap-4 w-full">
        <input 
          type="text" placeholder="what was it? (e.g. de.u coffee)" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-2/3 border-b border-gray-200 py-2 text-sm focus:outline-none focus:border-black bg-transparent min-w-0"
        />
        <input 
          type="text" inputMode="numeric" placeholder="total paid" value={amount} onChange={handleAmountChange}
          className="w-1/3 border-b border-gray-200 py-2 text-sm text-right focus:outline-none focus:border-black bg-transparent min-w-0"
        />
      </div>

      <div className="flex flex-col border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">paid by</span>
          <button 
            type="button" 
            onClick={() => setIsMultiplePayers(!isMultiplePayers)} 
            className="text-[10px] text-blue-500 hover:text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-md transition-colors"
          >
            {isMultiplePayers ? 'switch to single card' : 'multiple people paid?'}
          </button>
        </div>

        {!isMultiplePayers ? (
          <select 
            value={payerId} onChange={(e) => setPayerId(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-md py-1.5 px-2 text-xs outline-none focus:border-black w-full"
          >
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : (
          <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
            {members.map(m => (
              <div key={m.id} className="flex justify-between items-center">
                <span className="text-xs font-medium">{m.name}</span>
                <input 
                  type="text" inputMode="numeric" placeholder="0" 
                  value={payers[m.id] || ""} onChange={(e) => handlePayerChange(m.id, e.target.value)} 
                  className="w-24 text-right border-b border-gray-200 text-xs focus:outline-none focus:border-black py-1 bg-transparent" 
                />
              </div>
            ))}
            {(() => {
              let pSum = 0;
              Object.values(payers).forEach(v => pSum += getRawNumber(v));
              const diff = currentTotal - pSum;
              if (currentTotal > 0) {
                 return (
                   <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200 text-[10px]">
                     <span className="text-gray-400">total: {pSum.toLocaleString()}</span>
                     <span className={diff === 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                       {diff === 0 ? "matches bill ✓" : `remaining: ${diff.toLocaleString()}`}
                     </span>
                   </div>
                 )
              }
              return null;
            })()}
          </div>
        )}
      </div>

      <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
        <button type="button" onClick={() => setSplitType('equal')} className={`flex-1 py-1.5 text-[11px] rounded-md transition-colors ${splitType === 'equal' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>equal</button>
        <button type="button" onClick={() => setSplitType('exact')} className={`flex-1 py-1.5 text-[11px] rounded-md transition-colors ${splitType === 'exact' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>itemized</button>
        <button type="button" onClick={() => setSplitType('adjustment')} className={`flex-1 py-1.5 text-[11px] rounded-md transition-colors ${splitType === 'adjustment' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}>adjustments</button>
      </div>

      {(splitType === 'equal' || splitType === 'adjustment') && (
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex flex-col py-1">
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className="text-sm truncate flex-1">{m.name}</span>
                <button type="button" onClick={() => toggleInvolved(m.id)} className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${involvedIds.includes(m.id) ? 'bg-black border-black text-white' : 'border-gray-300'}`}>
                  {involvedIds.includes(m.id) && <span className="text-[10px]">✓</span>}
                </button>
                {splitType === 'adjustment' && <input type="text" inputMode="numeric" placeholder="+ extra" value={adjustments[m.id] || ""} onChange={(e) => handleAdjustmentChange(m.id, e.target.value)} className="w-20 text-right border-b border-gray-200 text-sm focus:outline-none focus:border-black py-1 bg-transparent" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {splitType === 'exact' && (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50 flex flex-col gap-3 transition-all">
              <div className="flex gap-2 items-start">
                <input type="text" placeholder="item name..." value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="flex-1 text-sm bg-transparent border-b border-gray-200 focus:outline-none focus:border-black py-1" />
                <input type="text" inputMode="numeric" placeholder="price" value={item.price ? formatNumber(item.price) : ""} onChange={(e) => handleItemChange(item.id, 'price', e.target.value)} className="w-24 text-sm text-right bg-transparent border-b border-gray-200 focus:outline-none focus:border-black py-1" />
                <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-gray-400 hover:text-red-500 px-1 py-1">×</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => {
                  const isAssigned = item.assignedTo.includes(m.id);
                  return <button key={m.id} type="button" onClick={() => toggleItemMember(item.id, m.id)} className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors ${isAssigned ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{m.name}</button>;
                })}
              </div>
            </div>
          ))}
          
          <button type="button" onClick={handleAddItem} className="w-full py-2 text-xs font-medium text-gray-500 hover:text-black border border-dashed border-gray-200 rounded-xl transition-colors">+ add item</button>
        </div>
      )}

      {splitType === 'exact' && itemsSum > 0 && difference !== 0 && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 text-center">
          subtotal is {itemsSum.toLocaleString()}. the {Math.abs(difference).toLocaleString()} {difference > 0 ? 'tax/service' : 'discount'} will be split proportionally.
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-medium transition-colors border border-gray-200">cancel</button>
        <button type="submit" className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors">{initialExpense ? 'update' : 'save'}</button>
      </div>
    </form>
  );
}