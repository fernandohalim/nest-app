"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useTripStore } from "@/store/useTripStore";
import { useUiStore } from "@/store/useUiStore";
import CreateTripModal from "./create-trip-modal";
import AboutModal from "./about-modal";
import ProfileMenu from "./profile-menu";
import ActionMenu from "./action-menu";

// Persistent desktop app shell. At lg+ a left sidebar rail replaces the mobile
// bottom nav (which stays home-only, untouched, below lg). The rail and the
// mobile bottom nav both drive the same global modals via useUiStore, so the
// "＋ new" / about / profile chrome works from any route.

function NavButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3.5 w-full px-4 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.97] ${
        active
          ? "bg-emerald-50 text-emerald-600 shadow-sm"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      }`}
    >
      <span className="shrink-0">{children}</span>
      <span>{label}</span>
    </button>
  );
}

function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const user = useTripStore((s) => s.user);
  const profile = useTripStore((s) => s.profile);
  const openActionMenu = useUiStore((s) => s.openActionMenu);
  const openAbout = useUiStore((s) => s.openAbout);
  const openProfile = useUiStore((s) => s.openProfile);

  const onHome = pathname === "/";
  const tab = searchParams.get("tab");
  const tripsActive = onHome && tab !== "quick";
  const receiptsActive = onHome && tab === "quick";

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName =
    profile?.nickname ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-stone-200/70 px-4 py-6 overflow-y-auto">
      {/* brand */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-3 px-3 mb-8 group text-left"
        aria-label="nest home"
      >
        <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] group-hover:scale-105 group-hover:-rotate-6 transition-transform shrink-0">
          🐣
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-2xl font-black text-stone-800 tracking-tighter">
            nest.
          </span>
          <span className="text-[10px] font-bold text-stone-400 tracking-wide">
            keeping the peace
          </span>
        </div>
      </button>

      {/* primary nav */}
      <nav className="flex flex-col gap-1.5">
        <NavButton
          active={tripsActive}
          onClick={() => router.push("/")}
          label="trips"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </NavButton>

        <NavButton
          active={receiptsActive}
          onClick={() => router.push("/?tab=quick")}
          label="receipts"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </NavButton>
      </nav>

      {/* new — the FAB, reborn as a full-width desktop button */}
      <button
        onClick={openActionMenu}
        className="mt-4 flex items-center justify-center gap-2.5 w-full px-4 py-3.5 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-600 active:scale-[0.97] transition-all"
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
            strokeWidth={3}
            d="M12 4v16m8-8H4"
          />
        </svg>
        new
      </button>

      {/* footer nav */}
      <div className="mt-auto flex flex-col gap-1.5 pt-6">
        <NavButton onClick={openAbout} label="about">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </NavButton>

        <button
          onClick={openProfile}
          className="flex items-center gap-3.5 w-full px-4 py-3 rounded-2xl font-black text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-all active:scale-[0.97] group"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center shrink-0 group-hover:opacity-80">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={fullName}
                width={24}
                height={24}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-black text-stone-500">
                {initial}
              </span>
            )}
          </div>
          <span className="truncate">{fullName}</span>
        </button>
      </div>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useTripStore((s) => s.user);
  const isCreateTripOpen = useUiStore((s) => s.isCreateTripOpen);
  const closeCreateTrip = useUiStore((s) => s.closeCreateTrip);
  const isAboutOpen = useUiStore((s) => s.isAboutOpen);
  const closeAbout = useUiStore((s) => s.closeAbout);
  const isProfileOpen = useUiStore((s) => s.isProfileOpen);
  const closeProfile = useUiStore((s) => s.closeProfile);

  // No chrome on auth screens, preview routes, or for signed-out visitors
  // (e.g. anonymous views of a public /trip/[id]) — matches today's behavior.
  const hideChrome =
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/previews");
  const showShell = Boolean(user) && !hideChrome;

  if (!showShell) return <>{children}</>;

  return (
    <div className="lg:flex lg:items-start">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 min-w-0">{children}</div>

      <ActionMenu />
      <CreateTripModal isOpen={isCreateTripOpen} onClose={closeCreateTrip} />
      <AboutModal isOpen={isAboutOpen} onClose={closeAbout} />
      <ProfileMenu isOpen={isProfileOpen} onClose={closeProfile} />
    </div>
  );
}
