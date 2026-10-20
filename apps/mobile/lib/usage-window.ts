import { dateLocaleForUi, t } from "./i18n";

const HOUR = 60;
const DAY = 24 * HOUR;

export function isWeeklyUsageWindow(minutes: number): boolean {
  return minutes === 7 * DAY;
}

/** "Weekly", "30-day" or "5-hour". */
export function usageWindowLabel(minutes: number): string {
  if (isWeeklyUsageWindow(minutes)) return t("Weekly");
  if (minutes % DAY === 0) return t("{days}-day", { days: minutes / DAY });
  return t("{hours}-hour", { hours: Math.round(minutes / HOUR) });
}

/** A time within the coming days, or a date once the reset is a week or more away. */
export function formatUsageReset(resetsAt: string): string {
  const reset = new Date(resetsAt);
  // A weekday alone is ambiguous once the reset is a week or more away.
  return reset.toLocaleString(
    dateLocaleForUi(),
    reset.getTime() - Date.now() < 6 * DAY * 60_000
      ? { weekday: "short", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  );
}
