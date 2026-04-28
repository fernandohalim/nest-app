import { Trip, Transaction, Expense } from "./types";

const getProportionalPayerCredit = (
  paidBy: Record<string, number>,
  settledAmount: number,
): Record<string, number> => {
  const totalPaid = Object.values(paidBy).reduce((sum, v) => sum + v, 0);
  if (totalPaid <= 0) return {};

  const credits: Record<string, number> = {};
  Object.entries(paidBy).forEach(([payerId, paidAmount]) => {
    credits[payerId] = (paidAmount / totalPaid) * settledAmount;
  });
  return credits;
};

const computeExpenseBalances = (
  expense: Expense,
): Record<string, number> => {
  const balances: Record<string, number> = {};

  const adjust = (memberId: string, delta: number) => {
    balances[memberId] = (balances[memberId] || 0) + delta;
  };

  // step 1: credit each payer for what they paid
  Object.entries(expense.paidBy || {}).forEach(([payerId, amount]) => {
    adjust(payerId, amount);
  });

  // step 2: debit each member for what they owe
  Object.entries(expense.owedBy || {}).forEach(([memberId, amount]) => {
    adjust(memberId, -amount);
  });

  // step 3: apply settled shares with proportional payer credit
  Object.entries(expense.settledShares || {}).forEach(([memberId, isSettled]) => {
    if (!isSettled) return;
    const debtAmount = expense.owedBy?.[memberId];
    if (!debtAmount || debtAmount <= 0) return;

    // the debtor effectively paid their share to the payer(s)
    adjust(memberId, debtAmount);

    // distribute that payment across payers proportionally
    const credits = getProportionalPayerCredit(expense.paidBy || {}, debtAmount);
    Object.entries(credits).forEach(([payerId, creditAmount]) => {
      adjust(payerId, -creditAmount);
    });
  });

  return balances;
};

export interface PaidLedgerItem {
  title: string;
  amount: number;
  isNegative?: boolean;
}

export interface OwedLedgerItem {
  title: string;
  amount: number;
  subItems?: string[];
  extra?: number;
  isSettled?: boolean;
  originalAmount?: number;
}

export interface MemberLedger {
  totalPaid: number;
  totalOwed: number;
  paidItems: PaidLedgerItem[];
  owedItems: OwedLedgerItem[];
}

export const getMemberLedger = (
  trip: Trip,
  memberId: string,
  formatAmount: (n: number) => string,
): MemberLedger => {
  const ledger: MemberLedger = {
    totalPaid: 0,
    totalOwed: 0,
    paidItems: [],
    owedItems: [],
  };

  const getMemberName = (id: string) =>
    trip.members.find((m) => m.id === id)?.name || "unknown";

  trip.expenses.forEach((exp) => {
    // direct payments by this member
    if (exp.paidBy?.[memberId]) {
      const paid = exp.paidBy[memberId];
      ledger.totalPaid += paid;
      ledger.paidItems.push({ title: exp.title, amount: paid });
    }

    // direct debts owed by this member
    const owed = exp.owedBy?.[memberId];
    if (owed && owed > 0) {
      ledger.totalOwed += owed;

      const isSettled = exp.settledShares?.[memberId] || false;
      const subItems: string[] = [];
      let originalSum = 0;

      if (exp.splitType === "exact" && exp.items) {
        const myItems = exp.items.filter((i) => i.assignedTo.includes(memberId));
        let myBaseSum = 0;
        myItems.forEach((i) => {
          const userShares = i.assignedTo.filter((id) => id === memberId).length;
          const totalShares = i.assignedTo.length;
          const shareText = totalShares > 1 ? ` (${userShares}/${totalShares})` : "";
          const myBaseShare = (i.price / totalShares) * userShares;
          myBaseSum += myBaseShare;
          originalSum += myBaseShare;
          subItems.push(
            `${i.name}${shareText} • ${formatAmount(myBaseShare)}`.trim(),
          );
        });

        const itemsSum = exp.items.reduce((acc, item) => acc + item.price, 0);
        const difference = exp.totalAmount - itemsSum;
        if (Math.abs(difference) > 0) {
          const extra = exp.adjustments?.[memberId] || 0;
          const diffShare = owed - myBaseSum - extra;
          if (Math.abs(diffShare) >= 0.5) {
            subItems.push(
              `${difference > 0 ? "tax & tip" : "global discount"} • ${
                diffShare > 0 ? "+" : ""
              }${formatAmount(diffShare)}`,
            );
          }
        }
      } else if (exp.splitType === "adjustment") {
        const extra = exp.adjustments?.[memberId] || 0;
        if (extra > 0) {
          subItems.push(`debt after split • ${formatAmount(owed - extra)}`);
          subItems.push(`adjusted bill • +${formatAmount(extra)}`);
        }
      }

      ledger.owedItems.push({
        title: exp.title,
        amount: owed,
        subItems: subItems.length > 0 ? subItems : undefined,
        extra: exp.adjustments?.[memberId],
        isSettled,
        originalAmount: originalSum > 0 ? originalSum : undefined,
      });

      if (isSettled) {
        // debtor side: they effectively paid this amount
        ledger.totalPaid += owed;
        ledger.paidItems.push({
          title: `✓ settled ${exp.title}`,
          amount: owed,
        });

        // payer side: each payer is credited proportionally.
        // we only modify ledger entries for THIS member, so we only care
        // about the case where THIS member is one of the payers.
        if (exp.paidBy?.[memberId]) {
          const credits = getProportionalPayerCredit(exp.paidBy, owed);
          const myCredit = credits[memberId] || 0;
          if (myCredit > 0) {
            ledger.totalPaid -= myCredit;
            ledger.paidItems.push({
              title: `↓ received cash from ${getMemberName(
                Object.keys(exp.owedBy).find((id) => id === memberId) ||
                  memberId,
              )} for ${exp.title}`,
              amount: -myCredit,
              isNegative: true,
            });
          }
        }
      }
    }

    if (exp.paidBy?.[memberId]) {
      Object.entries(exp.settledShares || {}).forEach(([debtorId, isSettled]) => {
        if (!isSettled || debtorId === memberId) return;
        const debtAmount = exp.owedBy?.[debtorId];
        if (!debtAmount) return;

        const credits = getProportionalPayerCredit(exp.paidBy, debtAmount);
        const myCredit = credits[memberId] || 0;
        if (myCredit > 0) {
          ledger.totalPaid -= myCredit;
          ledger.paidItems.push({
            title: `↓ received cash from ${getMemberName(debtorId)} for ${exp.title}`,
            amount: -myCredit,
            isNegative: true,
          });
        }
      });
    }
  });

  return ledger;
};

export function calculateSettlements(trip: Trip): Transaction[] {
  if (!trip || trip.members.length === 0 || trip.expenses.length === 0) {
    return [];
  }

  // step 1: aggregate net balances across all expenses
  const balances: Record<string, number> = {};
  trip.members.forEach((m) => {
    balances[m.id] = 0;
  });

  trip.expenses.forEach((exp) => {
    const expBalances = computeExpenseBalances(exp);
    Object.entries(expBalances).forEach(([memberId, delta]) => {
      if (balances[memberId] !== undefined) {
        balances[memberId] += delta;
      }
    });
  });

  // step 2: greedy debt-minimizing match
  // (largest debtor pays largest creditor first, which yields a near-optimal
  // transaction count in practice without the NP-hard exact solver)
  const debtors = trip.members
    .map((m) => ({ member: m, balance: balances[m.id] }))
    .filter((m) => m.balance < -0.01)
    .sort((a, b) => a.balance - b.balance);

  const creditors = trip.members
    .map((m) => ({ member: m, balance: balances[m.id] }))
    .filter((m) => m.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  const transactions: Transaction[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const transferAmount = Math.min(Math.abs(debtor.balance), creditor.balance);

    transactions.push({
      from: debtor.member,
      to: creditor.member,
      amount: transferAmount,
    });

    debtor.balance += transferAmount;
    creditor.balance -= transferAmount;

    if (Math.abs(debtor.balance) < 0.01) d++;
    if (creditor.balance < 0.01) c++;
  }

  return transactions;
}