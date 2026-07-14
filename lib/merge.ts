import { v4 as uuidv4 } from "uuid";
import { Member, ExpenseItem } from "./types";

// Everything we need from a selected quick split to fold it into a trip.
// `ephemeralMembers` is the roster shown in the resolver; the four member-keyed
// fields are what get rewritten. settledShares is deliberately absent — merging
// resets settled state.
export interface MergeSourceSplit {
  id: string;
  title: string;
  ephemeralMembers: Member[];
  paidBy: Record<string, number>;
  owedBy: Record<string, number>;
  adjustments?: Record<string, number> | null;
  items?: ExpenseItem[] | null;
}

// One resolved person in the merged trip. `id` becomes a `members.id`: for an
// existing trip member it's that member's id (so we don't duplicate them); for
// a new person it's a freshly generated uuid the RPC inserts.
export interface ResolvedMember {
  id: string;
  name: string;
  isExisting: boolean; // already a member of the target trip — do not re-insert
  sources: { splitId: string; memberId: string }[];
}

// Per-expense payload handed to the merge_quick_splits RPC. Member ids here are
// already rewritten into the trip namespace.
export interface MergeExpensePayload {
  id: string;
  paid_by: Record<string, number>;
  owed_by: Record<string, number>;
  adjustments: Record<string, number> | null;
  items: ExpenseItem[] | null;
}

// Sum values into the target namespace. When two source members collapse into
// one person (the "merge together" case, or "you" appearing in several splits),
// their amounts add up rather than clobbering each other.
const remapSum = (
  src: Record<string, number> | undefined | null,
  localMap: Map<string, string>,
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!src) return out;
  for (const [oldId, val] of Object.entries(src)) {
    const finalId = localMap.get(oldId) ?? oldId;
    out[finalId] = (out[finalId] ?? 0) + val;
  }
  return out;
};

// Seed resolution with the "keep everyone separate" default the user chose.
// Two exceptions to "separate":
//   - the current user (member id === userId) is the same literal identity in
//     every split, so it always collapses to a single trip member.
//   - existing members of the target trip are listed up front as merge targets;
//     they carry no sources until the user merges someone into them.
export function buildInitialResolution(
  splits: MergeSourceSplit[],
  userId: string,
  existingMembers: Member[] = [],
): ResolvedMember[] {
  const resolved: ResolvedMember[] = [];

  for (const em of existingMembers) {
    resolved.push({ id: em.id, name: em.name, isExisting: true, sources: [] });
  }

  const youSources: { splitId: string; memberId: string }[] = [];
  let youName = "me";
  for (const split of splits) {
    for (const m of split.ephemeralMembers) {
      if (m.id === userId) {
        youSources.push({ splitId: split.id, memberId: m.id });
        youName = m.name;
      }
    }
  }
  if (youSources.length > 0) {
    resolved.push({
      id: uuidv4(),
      name: youName,
      isExisting: false,
      sources: youSources,
    });
  }

  for (const split of splits) {
    for (const m of split.ephemeralMembers) {
      if (m.id === userId) continue;
      resolved.push({
        id: uuidv4(),
        name: m.name,
        isExisting: false,
        sources: [{ splitId: split.id, memberId: m.id }],
      });
    }
  }

  return resolved;
}

// Rewrite every member-keyed field of each split into the trip namespace using
// the resolution. Numeric maps sum on collision; item assignments dedupe so a
// person merged with themselves inside one receipt counts as one share.
export function buildExpensePayloads(
  splits: MergeSourceSplit[],
  resolved: ResolvedMember[],
): MergeExpensePayload[] {
  return splits.map((split) => {
    const localMap = new Map<string, string>();
    for (const r of resolved) {
      for (const s of r.sources) {
        if (s.splitId === split.id) localMap.set(s.memberId, r.id);
      }
    }

    const paid_by = remapSum(split.paidBy, localMap);
    const owed_by = remapSum(split.owedBy, localMap);
    const adjustments =
      split.adjustments && Object.keys(split.adjustments).length > 0
        ? remapSum(split.adjustments, localMap)
        : null;

    const items: ExpenseItem[] | null = split.items
      ? split.items.map((it) => ({
          ...it,
          assignedTo: Array.from(
            new Set(it.assignedTo.map((id) => localMap.get(id) ?? id)),
          ),
        }))
      : null;

    return { id: split.id, paid_by, owed_by, adjustments, items };
  });
}

// Members the RPC must INSERT: resolved people who aren't already trip members.
export function membersToInsert(
  resolved: ResolvedMember[],
): { id: string; name: string }[] {
  return resolved
    .filter((r) => !r.isExisting && r.sources.length > 0)
    .map((r) => ({ id: r.id, name: r.name }));
}
