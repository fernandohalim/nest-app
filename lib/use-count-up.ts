import { useEffect, useRef, useState } from "react";

// eases a number from what's on screen to its new value (ease-out cubic), so
// adding or deleting an expense visibly rolls the total instead of swapping
// it. pass `ready` false while the data is still loading: the number snaps
// (no roll from 0 on page load) until the first real value has landed.
// `counting` is true while it runs, for a one-shot pop on the number.
export function useCountUp(target: number, ready = true, ms = 650) {
  const [shown, setShown] = useState(target);
  const [wasReady, setWasReady] = useState(ready);

  // adjust during render: snap while loading and on the first loaded value
  if (!ready || !wasReady) {
    if (ready !== wasReady) setWasReady(ready);
    if (shown !== target) setShown(target);
  }

  // what's on screen right now — the start point of the next roll
  const fromRef = useRef(target);
  useEffect(() => {
    fromRef.current = shown;
  });

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      // cents are the finest unit any currency here shows
      const v =
        t === 1
          ? target
          : Math.round((from + (target - from) * eased) * 100) / 100;
      fromRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return { value: shown, counting: shown !== target };
}
