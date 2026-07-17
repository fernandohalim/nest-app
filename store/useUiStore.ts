import { create } from "zustand";

// Global UI state for the chrome that lives outside any single page — the
// "＋ new" action menu, the create-trip modal it launches, the about modal, and
// the profile menu. Both the mobile bottom nav (home page) and the desktop
// sidebar (app shell) drive these, and the modals themselves render once,
// globally, in <AppShell>. Keeping the open/close flags here avoids
// prop-drilling or duplicating the modal JSX.
//
// `homeView` is here for the same reason: the home tabs have two drivers (the
// mobile bottom nav and the desktop sidebar, which lives outside the page).
// It is the source of truth — the `?tab=` param is written *from* it, never
// the other way around. Routing it through the URL instead meant the desktop
// tabs only worked if a router push round-tripped back through
// useSearchParams(), which is exactly what fails in the macOS Safari dock app.
export type HomeView = "trips" | "quick";

// read the deep link once, at store creation, so the first render is already
// correct and no "switch" is observed on mount. safe to touch window here:
// <AuthProvider> renders a loading screen until the session resolves, so every
// consumer of this store mounts client-side only.
const initialHomeView = (): HomeView =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("tab") === "quick"
    ? "quick"
    : "trips";

interface UiState {
  isActionMenuOpen: boolean;
  isCreateTripOpen: boolean;
  isAboutOpen: boolean;
  isProfileOpen: boolean;
  homeView: HomeView;
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
  setHomeView: (mode: HomeView) => void;
}

export const useUiStore = create<UiState & UiActions>((set) => ({
  isActionMenuOpen: false,
  isCreateTripOpen: false,
  isAboutOpen: false,
  isProfileOpen: false,
  homeView: initialHomeView(),

  openActionMenu: () => set({ isActionMenuOpen: true }),
  closeActionMenu: () => set({ isActionMenuOpen: false }),
  openCreateTrip: () => set({ isCreateTripOpen: true }),
  closeCreateTrip: () => set({ isCreateTripOpen: false }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openProfile: () => set({ isProfileOpen: true }),
  closeProfile: () => set({ isProfileOpen: false }),
  setHomeView: (mode) => set({ homeView: mode }),
}));
