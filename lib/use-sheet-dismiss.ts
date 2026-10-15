import { useCallback, useEffect, useRef } from "react";

// dismiss gestures for the bottom sheets. returns a callback ref for the sheet
// body (the `slide-in-from-bottom-full` element) that wires up:
//
// swipe down (phones). a sheet that slides up promises it can be flicked back
// down — this keeps that promise.
// - phones only (below sm): from sm up the sheet is a centred modal.
// - a gesture only becomes a drag when it starts downward, mostly vertical,
//   and every scroll box between the finger and the sheet is at its top —
//   so scrolling a long list never yanks the sheet.
// - `swipe: false` turns this part off, for the centred pop-ups (members,
//   trip settings, alerts) that zoom in rather than slide up — they still
//   get the scroll lock and escape below.
// - `gripOnly` sheets (forms, where a stray swipe would cost typed input)
//   only drag from inside a `data-sheet-grip` element, e.g. their header.
// - transforms are written straight to the node (no re-render per frame).
//   the exit animation in globals.css has no `from` frame, so on dismiss it
//   picks up from wherever the finger left the sheet and slides on down.
//
// scroll lock (phones). while any sheet is up the page behind it stays put —
// a swipe on the backdrop used to scroll the list underneath.
//
// escape (keyboards). only the topmost open sheet answers, so a sheet
// stacked on another closes one layer at a time. typing in a field is left
// alone — escape there shouldn't throw away a half-filled form.
const PHONE = "(max-width: 39.999rem)"; // below tailwind's sm
const DISMISS_PX = 110;
const DISMISS_VELOCITY = 0.6; // px/ms — a quick flick counts even if short

// mounted sheets in open order; the last one is on top
const stack: HTMLElement[] = [];

function onEscape(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  const el = document.activeElement;
  if (
    el instanceof HTMLElement &&
    el.closest("input, textarea, select, [contenteditable]")
  )
    return;
  const top = stack[stack.length - 1];
  if (top) closers.get(top)?.();
}
const closers = new WeakMap<HTMLElement, () => void>();

function scrolledFromTop(target: EventTarget | null, sheet: HTMLElement) {
  let el = target instanceof Element ? target : null;
  while (el && el !== sheet) {
    if (el instanceof HTMLElement && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return sheet.scrollTop > 0;
}

export function useSheetDismiss<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  {
    gripOnly = false,
    swipe = true,
  }: { gripOnly?: boolean; swipe?: boolean } = {},
) {
  // the latest onClose without re-attaching listeners every render
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  return useCallback(
    (sheet: T | null) => {
      if (!sheet) return;

      let startX = 0;
      let startY = 0;
      let lastY = 0;
      let lastT = 0;
      let velocity = 0;
      // null = undecided, true = dragging the sheet, false = let it scroll
      let dragging: boolean | null = null;

      const onStart = (e: TouchEvent) => {
        const t = e.target as Element | null;
        if (
          e.touches.length !== 1 ||
          !window.matchMedia(PHONE).matches ||
          (gripOnly && !t?.closest("[data-sheet-grip]")) ||
          t?.closest("[data-no-sheet-drag]") ||
          scrolledFromTop(t, sheet)
        ) {
          dragging = false;
          return;
        }
        startX = e.touches[0].clientX;
        startY = lastY = e.touches[0].clientY;
        lastT = e.timeStamp;
        velocity = 0;
        dragging = null;
      };

      const onMove = (e: TouchEvent) => {
        if (dragging === false) return;
        const y = e.touches[0].clientY;
        const dy = y - startY;
        if (dragging === null) {
          const dx = e.touches[0].clientX - startX;
          if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
          if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
            dragging = false;
            return;
          }
          dragging = true;
          sheet.style.transition = "none";
          // a focused input would keep the keyboard up while the sheet leaves
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
        e.preventDefault();
        const dt = e.timeStamp - lastT;
        if (dt > 0) velocity = (y - lastY) / dt;
        lastY = y;
        lastT = e.timeStamp;
        sheet.style.transform = `translate3d(0, ${Math.max(0, dy)}px, 0)`;
      };

      const onEnd = () => {
        if (!dragging) {
          dragging = null;
          return;
        }
        dragging = null;
        const dy = lastY - startY;
        if (dy > DISMISS_PX || velocity > DISMISS_VELOCITY) {
          // leave the transform in place — the exit animation runs from here
          closeRef.current();
          return;
        }
        sheet.style.transition =
          "transform 250ms cubic-bezier(0.16, 1, 0.3, 1)";
        sheet.style.transform = "";
        const clear = () => {
          sheet.style.transition = "";
          sheet.removeEventListener("transitionend", clear);
        };
        sheet.addEventListener("transitionend", clear);
      };

      stack.push(sheet);
      closers.set(sheet, () => closeRef.current());
      if (stack.length === 1) {
        document.addEventListener("keydown", onEscape);
        // phones only: desktop scrollbars take width, and hiding one would
        // shove the whole layout sideways
        if (window.matchMedia(PHONE).matches)
          document.documentElement.style.overflow = "hidden";
      }

      const release = () => {
        stack.splice(stack.indexOf(sheet), 1);
        if (stack.length === 0) {
          document.removeEventListener("keydown", onEscape);
          document.documentElement.style.overflow = "";
        }
      };
      if (!swipe) return release;

      sheet.addEventListener("touchstart", onStart, { passive: true });
      sheet.addEventListener("touchmove", onMove, { passive: false });
      sheet.addEventListener("touchend", onEnd);
      sheet.addEventListener("touchcancel", onEnd);
      return () => {
        release();
        sheet.removeEventListener("touchstart", onStart);
        sheet.removeEventListener("touchmove", onMove);
        sheet.removeEventListener("touchend", onEnd);
        sheet.removeEventListener("touchcancel", onEnd);
        sheet.style.transform = "";
        sheet.style.transition = "";
      };
    },
    [gripOnly, swipe],
  );
}
