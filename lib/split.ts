// weighted "equally" splits (3.3.1). the weights aren't stored anywhere —
// every share in owedBy is total × weight / totalWeight, so the smallest
// whole-number ratio between the shares gives the weights back. that keeps
// the db schema and the merge RPC untouched, and old equal splits (all
// shares identical) simply read back as x1 each.
const MAX_BASE_WEIGHT = 20;

export const getEqualSplitWeights = (
  owedBy: Record<string, number>,
): Record<string, number> => {
  const entries = Object.entries(owedBy || {}).filter(([, v]) => v > 0);
  if (entries.length === 0) return {};

  const min = Math.min(...entries.map(([, v]) => v));
  const ratios = entries.map(([id, v]) => [id, v / min] as const);

  for (let k = 1; k <= MAX_BASE_WEIGHT; k++) {
    const isWhole = ratios.every(
      ([, r]) => Math.abs(r * k - Math.round(r * k)) < 1e-6,
    );
    if (isWhole) {
      return Object.fromEntries(
        ratios.map(([id, r]) => [id, Math.round(r * k)]),
      );
    }
  }

  // shouldn't happen for anything the form saves — best effort
  return Object.fromEntries(
    ratios.map(([id, r]) => [id, Math.max(1, Math.round(r))]),
  );
};

export const isWeightedSplit = (weights: Record<string, number>) =>
  Object.values(weights).some((w) => w !== 1);

export const getTotalWeight = (weights: Record<string, number>) =>
  Object.values(weights).reduce((s, w) => s + w, 0);
