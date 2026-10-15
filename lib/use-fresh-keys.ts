import { useState } from "react";

const NONE = new Set<string>();

// which rows just appeared? keys present when the list first loads are
// "known" and never animate (no page-load cascade); keys that show up later —
// a new or merged receipt, a new expense, the next infinite-scroll page —
// come back as fresh, so the row can mount with an enter animation.
// reordering, filtering back to rows seen before, or editing in place never
// count as new. pass `ready` false while the data is still loading.
export function useFreshKeys(keys: string[], ready = true): Set<string> {
  const sig = keys.join("|");
  const [state, setState] = useState(() => ({
    sig,
    ready,
    known: new Set(keys),
    fresh: NONE,
  }));

  // adjust during render so fresh rows get their class on their first paint
  if (!ready || !state.ready) {
    // loading, or the first loaded render: everything here is the baseline
    if (state.sig !== sig || state.ready !== ready)
      setState({ sig, ready, known: new Set(keys), fresh: NONE });
    return NONE;
  }
  if (state.sig !== sig) {
    const fresh = new Set(keys.filter((k) => !state.known.has(k)));
    const known = new Set(state.known);
    keys.forEach((k) => known.add(k));
    setState({ sig, ready, known, fresh });
    return fresh;
  }
  return state.fresh;
}
