// 3.1 retention rule, shared by trips and quick splits:
//   anything not kept auto-deletes after RETENTION_DAYS.
//   - trips:        counted from the last activity (updated_at)
//   - quick splits: counted from retention_from (creation, or when un-kept)
//
// the actual delete is a pg_cron job (cleanup-stale-trips /
// cleanup-ephemeral-expenses) that runs daily at 00:00 UTC and removes rows
// whose anchor is older than 7 days. so a row really disappears at the first
// UTC midnight *after* anchor + 7 days — counting in local calendar days to
// that moment keeps "expires today" honest instead of a floor()ed "1 day".

export const RETENTION_DAYS = 7;

const DAY_MS = 1000 * 60 * 60 * 24;

export function getDeletionTime(anchorIso: string | undefined): Date {
  const anchor = anchorIso ? new Date(anchorIso).getTime() : Date.now();
  const threshold = anchor + RETENTION_DAYS * DAY_MS;
  const d = new Date(threshold);
  // next 00:00 UTC strictly after the threshold (cron uses `<`)
  const nextMidnight = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + 1,
  );
  return new Date(nextMidnight);
}

export interface RetentionInfo {
  // local calendar days until deletion; 0 = goes tonight / today
  daysLeft: number;
  isUrgent: boolean;
  // "expires today" / "expires in 3 days"
  label: string;
  // "today" / "3 days left" — compact form for cards
  shortLabel: string;
}

export function getRetention(
  anchorIso: string | undefined,
  now: number = Date.now(),
): RetentionInfo {
  const deletion = getDeletionTime(anchorIso);
  const today = new Date(now);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const startOfDeletionDay = new Date(
    deletion.getFullYear(),
    deletion.getMonth(),
    deletion.getDate(),
  ).getTime();
  const daysLeft = Math.max(
    0,
    Math.round((startOfDeletionDay - startOfToday) / DAY_MS),
  );

  return {
    daysLeft,
    isUrgent: daysLeft <= 2,
    label:
      daysLeft === 0
        ? "expires today"
        : `expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    shortLabel:
      daysLeft === 0
        ? "expires today"
        : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`,
  };
}

// single source of truth for the user-facing rule, reused by every ⓘ and the
// home "how it works" modal so the copy can't drift from the cron again.
export const RETENTION_RULE =
  "anything you don't keep auto-deletes after 7 days. trips count from their last activity, receipts from when they were made. tap \"keep forever 📌\" to save one — you can stop keeping it anytime, which starts a fresh 7 days.";
