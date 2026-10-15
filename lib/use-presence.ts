import { useEffect, useState } from "react";

// exit animations for overlays. a modal that did `if (!isOpen) return null`
// vanished the instant it closed; this keeps it mounted for EXIT_MS more with
// `closing` set, so the root can carry `data-closing` — globals.css then plays
// every `animate-in` inside it in reverse (sheets slide down, modals zoom out,
// backdrops fade) using the same enter vars it came in with.
export const EXIT_MS = 200;

export function usePresence(open: boolean) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // adjust during render (not in an effect) so opening never flashes a frame
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const t = setTimeout(
      () => {
        setRender(false);
        setClosing(false);
      },
      reduced ? 0 : EXIT_MS,
    );
    return () => clearTimeout(t);
  }, [closing]);

  return { render, closing };
}

// overlays fed by state that's cleared in the same breath as they close
// (`sheetExpense`, `editingExpense`…) would lose their content mid-exit —
// this hands back the value as it was while `open`, so the exit animation
// still draws what was on screen. value must be stable (state, or a .find()
// on state), not rebuilt every render.
export function useHeld<T>(value: T, open: boolean): T {
  const [held, setHeld] = useState(value);
  if (open && held !== value) setHeld(value);
  return open ? value : held;
}
