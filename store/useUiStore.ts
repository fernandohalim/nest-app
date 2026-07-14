import { create } from "zustand";

// Global UI state for the chrome that lives outside any single page — the
// "＋ new" action menu, the create-trip modal it launches, the about modal, and
// the profile menu. Both the mobile bottom nav (home page) and the desktop
// sidebar (app shell) drive these, and the modals themselves render once,
// globally, in <AppShell>. Keeping the open/close flags here avoids
// prop-drilling or duplicating the modal JSX.
interface UiState {
  isActionMenuOpen: boolean;
  isCreateTripOpen: boolean;
  isAboutOpen: boolean;
  isProfileOpen: boolean;
}

interface UiActions {
  openActionMenu: () => void;
  closeActionMenu: () => void;
  openCreateTrip: () => void;
  closeCreateTrip: () => void;
  openAbout: () => void;
  closeAbout: () => void;
  openProfile: () => void;
  closeProfile: () => void;
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  isActionMenuOpen: false,
  isCreateTripOpen: false,
  isAboutOpen: false,
  isProfileOpen: false,

  openActionMenu: () => set({ isActionMenuOpen: true }),
  closeActionMenu: () => set({ isActionMenuOpen: false }),
  openCreateTrip: () => set({ isCreateTripOpen: true }),
  closeCreateTrip: () => set({ isCreateTripOpen: false }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openProfile: () => set({ isProfileOpen: true }),
  closeProfile: () => set({ isProfileOpen: false }),
}));
