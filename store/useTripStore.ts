import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Trip, Expense, Member, ExpenseItem } from "@/lib/types";
import { User } from "@supabase/supabase-js";

interface TripStore {
  user: User | null;
  setUser: (user: User | null) => void;
  trips: Trip[];
  isLoading: boolean;
  fetchTrips: () => Promise<void>;
  fetchTrip: (tripId: string) => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  renameTrip: (tripId: string, newName: string) => Promise<void>;
  updateTripStatus: (tripId: string, status: string) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  addMember: (tripId: string, member: Member) => Promise<void>;
  updateMember: (tripId: string, memberId: string, newName: string) => Promise<void>;
  deleteMember: (tripId: string, memberId: string) => Promise<void>;
  addExpense: (tripId: string, expense: Expense) => Promise<void>;
  updateExpense: (
    tripId: string,
    expenseId: string,
    expense: Expense,
  ) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  toggleExpenseSettled: (
    tripId: string,
    expenseId: string,
    memberId: string,
  ) => Promise<void>;
  subscribeToTrip: (tripId: string) => () => void;
  isSyncing: boolean;
  toggleCollaborative: (
    tripId: string,
    isCollaborative: boolean,
  ) => Promise<void>;
}

interface SupabaseExpenseRow {
  id: string;
  title: string;
  total_amount: number;
  paid_by: Record<string, number>;
  owed_by: Record<string, number>;
  split_type: "equal" | "exact" | "adjustment";
  items?: ExpenseItem[];
  adjustments?: Record<string, number>;
  settled_shares?: Record<string, boolean>;
  expense_date: string;
  created_at: string;
  category: string;
}

interface SupabaseTripRow {
  id: string;
  name: string;
  date: string;
  currency: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_name: string;
  status: string;
  is_collaborative: boolean;
}

const mapExpense = (exp: SupabaseExpenseRow): Expense => ({
  id: exp.id,
  title: exp.title,
  totalAmount: exp.total_amount,
  paidBy: exp.paid_by,
  owedBy: exp.owed_by,
  splitType: exp.split_type,
  items: exp.items,
  adjustments: exp.adjustments,
  settledShares: exp.settled_shares,
  expenseDate: exp.expense_date,
  createdAt: exp.created_at,
  category: exp.category || "other",
});

export const useTripStore = create<TripStore>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),

  trips: [],
  isLoading: false,
  isSyncing: false,

  fetchTrips: async () => {
    const currentUser = get().user;
    if (!currentUser) return;

    set({ isLoading: true });

    const { data: ownedTrips } = await supabase
      .from("trips")
      .select("*")
      .eq("owner_id", currentUser.id);
    const { data: linkedData } = await supabase
      .from("user_trips")
      .select("trips(*)")
      .eq("user_id", currentUser.id);

    const allTripsMap = new Map<string, SupabaseTripRow>();

    if (ownedTrips) {
      ownedTrips.forEach((t) => allTripsMap.set(t.id, t));
    }

    if (linkedData) {
      const safeLinkedData = linkedData as unknown as {
        trips: SupabaseTripRow | SupabaseTripRow[] | null;
      }[];
      safeLinkedData.forEach((link) => {
        if (!link.trips) return;
        if (Array.isArray(link.trips)) {
          link.trips.forEach((t) => allTripsMap.set(t.id, t));
        } else {
          allTripsMap.set(link.trips.id, link.trips);
        }
      });
    }

    const combinedTrips = Array.from(allTripsMap.values()).sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const mappedTrips = combinedTrips.map((t) => ({
      id: t.id,
      name: t.name,
      date: t.date || "",
      currency: t.currency || "IDR",
      createdAt: t.created_at,
      updatedAt: t.updated_at || t.created_at,
      owner_id: t.owner_id,
      owner_name: t.owner_name,
      status: t.status || "ongoing",
      members: [],
      expenses: [],
      is_collaborative: t.is_collaborative || false,
    }));

    set({ trips: mappedTrips, isLoading: false });
  },

  fetchTrip: async (tripId: string) => {
    set({ isLoading: true });

    const [tripRes, membersRes, expensesRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase.from("members").select("*").eq("trip_id", tripId),
      supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("expense_date", { ascending: false }),
    ]);

    if (tripRes.error || !tripRes.data) {
      set({ isLoading: false });
      return;
    }

    const fullTrip: Trip = {
      id: tripRes.data.id,
      name: tripRes.data.name,
      date: tripRes.data.date || "",
      currency: tripRes.data.currency || "IDR",
      createdAt: tripRes.data.created_at,
      updatedAt: tripRes.data.updated_at || tripRes.data.created_at,
      owner_id: tripRes.data.owner_id,
      owner_name: tripRes.data.owner_name,
      status: tripRes.data.status || "ongoing", // <-- NEW
      members: membersRes.data || [],
      expenses: (expensesRes.data || []).map(mapExpense),
      is_collaborative: tripRes.data.is_collaborative || false,
    };

    set((state) => {
      const exists = state.trips.find((t) => t.id === tripId);
      if (exists)
        return {
          trips: state.trips.map((t) => (t.id === tripId ? fullTrip : t)),
          isLoading: false,
        };
      return { trips: [...state.trips, fullTrip], isLoading: false };
    });
  },

  addTrip: async (trip) => {
    set({ isSyncing: true });
    const currentUser = get().user;
    if (!currentUser) return;

    set((state) => ({ trips: [trip, ...state.trips] }));
    const displayName =
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "someone";

    await supabase.from("trips").insert({
      id: trip.id,
      name: trip.name,
      date: trip.date,
      currency: trip.currency,
      created_at: trip.createdAt,
      owner_id: currentUser.id,
      owner_name: displayName,
      status: trip.status || "ongoing",
    });
    set({ isSyncing: false });
  },

  renameTrip: async (tripId, newName) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId ? { ...t, name: newName } : t,
      ),
    }));
    await supabase.from("trips").update({ name: newName }).eq("id", tripId);
    set({ isSyncing: false });
  },

  updateTripStatus: async (tripId, status) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) => (t.id === tripId ? { ...t, status } : t)),
    }));
    await supabase.from("trips").update({ status }).eq("id", tripId);
    set({ isSyncing: false });
  },

  toggleCollaborative: async (tripId, isCollaborative) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId ? { ...t, is_collaborative: isCollaborative } : t,
      ),
    }));
    await supabase
      .from("trips")
      .update({ is_collaborative: isCollaborative })
      .eq("id", tripId);
    set({ isSyncing: false });
  },

  deleteTrip: async (tripId) => {
    set({ isSyncing: true });
    set((state) => ({ trips: state.trips.filter((t) => t.id !== tripId) }));
    await supabase.from("trips").delete().eq("id", tripId);
    set({ isSyncing: false });
  },

  addMember: async (tripId, member) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId ? { ...t, members: [...t.members, member] } : t,
      ),
    }));
    await supabase
      .from("members")
      .insert({ id: member.id, trip_id: tripId, name: member.name });
    set({ isSyncing: false });
  },

  updateMember: async (tripId, memberId, newName) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              members: t.members.map((m) =>
                m.id === memberId ? { ...m, name: newName } : m,
              ),
            }
          : t,
      ),
    }));
    await supabase.from("members").update({ name: newName }).eq("id", memberId);
    set({ isSyncing: false });
  },

  deleteMember: async (tripId, memberId) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? { ...t, members: t.members.filter((m) => m.id !== memberId) }
          : t,
      ),
    }));
    await supabase.from("members").delete().eq("id", memberId);
    set({ isSyncing: false });
  },

  addExpense: async (tripId, expense) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id === tripId) {
          const newExpenses = [expense, ...t.expenses].sort(
            (a, b) =>
              new Date(b.expenseDate).getTime() -
              new Date(a.expenseDate).getTime(),
          );
          return { ...t, expenses: newExpenses };
        }
        return t;
      }),
    }));
    await supabase.from("expenses").insert({
      id: expense.id,
      trip_id: tripId,
      title: expense.title,
      total_amount: expense.totalAmount,
      paid_by: expense.paidBy,
      owed_by: expense.owedBy,
      split_type: expense.splitType,
      items: expense.items || null,
      adjustments: expense.adjustments || null,
      settled_shares: expense.settledShares || null,
      expense_date: expense.expenseDate,
      created_at: expense.createdAt,
      category: expense.category || "other",
    });
    set({ isSyncing: false });
  },

  updateExpense: async (tripId, expenseId, expense) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id === tripId) {
          const newExpenses = t.expenses
            .map((e) => (e.id === expenseId ? expense : e))
            .sort(
              (a, b) =>
                new Date(b.expenseDate).getTime() -
                new Date(a.expenseDate).getTime(),
            );
          return { ...t, expenses: newExpenses };
        }
        return t;
      }),
    }));
    await supabase
      .from("expenses")
      .update({
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
      })
      .eq("id", expenseId);
    set({ isSyncing: false });
  },

  deleteExpense: async (tripId, expenseId) => {
    set({ isSyncing: true });
    set((state) => ({
      trips: state.trips.map((t) =>
        t.id === tripId
          ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }
          : t,
      ),
    }));
    await supabase.from("expenses").delete().eq("id", expenseId);
    set({ isSyncing: false });
  },

  toggleExpenseSettled: async (tripId, expenseId, memberId) => {
    set({ isSyncing: true });

    const state = get();
    const trip = state.trips.find((t) => t.id === tripId);
    const expense = trip?.expenses.find((e) => e.id === expenseId);

    if (!expense) {
      set({ isSyncing: false });
      return;
    }

    const updatedShares = {
      ...expense.settledShares,
      [memberId]: !(expense.settledShares?.[memberId] || false),
    };

    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            expenses: t.expenses.map((e) =>
              e.id === expenseId ? { ...e, settledShares: updatedShares } : e,
            ),
          };
        }
        return t;
      }),
    }));

    await supabase
      .from("expenses")
      .update({ settled_shares: updatedShares })
      .eq("id", expenseId);
    set({ isSyncing: false });
  },

  subscribeToTrip: (tripId: string) => {
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          get().fetchTrip(tripId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "members",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          get().fetchTrip(tripId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
