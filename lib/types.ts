export interface Member {
  id: string;
  name: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

export interface Expense {
  id: string;
  title: string;
  totalAmount: number;
  paidBy: Record<string, number>; 
  owedBy: Record<string, number>; 
  splitType: 'equal' | 'exact' | 'adjustment'; 
  
  items?: ExpenseItem[];
  adjustments?: Record<string, number>;
  settledShares?: Record<string, boolean>; 

  expenseDate: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  name: string;
  date: string;
  currency: string;
  members: Member[];
  expenses: Expense[];
  isReadOnly?: boolean; 
  createdAt: string;
  owner_id?: string;
  owner_name?: string;
}