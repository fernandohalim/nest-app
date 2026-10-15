import { useEffect, useRef } from "react";

// 3.4.2 swipe between the home tabs (trips ⇄ receipts) on phones.
//
// - below lg only: from lg up the sidebar replaces the bottom nav.
// - only a clear horizontal flick counts — mostly sideways, long enough, and
//   not too slow — so ordinary scrolling never flips the page.
// - stands down while a sheet is up (use-sheet-dismiss locks page scroll by
//   setting overflow on <html>), when the touch starts in a field or a
//   sideways-scrolling box, or on anything marked `data-no-swipe-nav`.
// - `enabled: false` turns it off, e.g. during merge select mode, where a
//   tab switch would throw away the selection.
const PHONE = "(max-width: 63.999rem)"; // below tailwind's lg
const MIN_PX = 70;
const MAX_MS = 600;
const RATIO = 1.7; // |dx| must beat |dy| by this much

function scrollsSideways(target: EventTarget | null) {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function useSwipeNav(
  onSwipe: (direction: "left" | "right") => void,
  enabled = true,
) {
  const swipeRef = useRef(onSwipe);
  useEffect(() => {
    swipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      const t = e.target as Element | null;
      tracking =
        e.touches.length === 1 &&
        window.matchMedia(PHONE).matches &&
        document.documentElement.style.overflow !== "hidden" &&
        !t?.closest(
          'input, textarea, select, [contenteditable], [role="dialog"], [data-no-swipe-nav]',
        ) &&
        !scrollsSideways(t);
      if (!tracking) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = e.timeStamp;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (
        Math.abs(dx) < MIN_PX ||
        Math.abs(dx) < Math.abs(dy) * RATIO ||
        e.timeStamp - startT > MAX_MS
      )
        return;
      swipeRef.current(dx < 0 ? "left" : "right");
    };

    const onCancel = () => {
      tracking = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled]);
}
