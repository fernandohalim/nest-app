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
  splitType: "equal" | "exact" | "adjustment";

  items?: ExpenseItem[];
  adjustments?: Record<string, number>;
  settledShares?: Record<string, boolean>;

  expenseDate: string;
  createdAt: string;
  category?: string;
}

export interface Trip {
  id: string;
  name: string;
  date: string;
  currency: string;
  members: Member[];
  expenses: Expense[];
  createdAt: string;
  updatedAt?: string;
  owner_id?: string;
  owner_name?: string;
  status?: string;
  is_collaborative?: boolean;
}

export interface Release {
  version: string;
  date: string;
  title: string;
  badge: string;
  badgeColor: string;
  features: string[];
}

export interface Transaction {
  from: Member;
  to: Member;
  amount: number;
}

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface CameraScannerProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUploadFallback: () => void;
}

export interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export interface Option {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

export interface ExpenseFormProps {
  members: Member[];
  initialExpense?: Expense;
  onSave: (expense: Expense) => void;
  onCancel: () => void;
  currencySymbol?: string;
}