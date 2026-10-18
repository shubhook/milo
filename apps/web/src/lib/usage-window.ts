import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";

const HOUR = 60;
const DAY = 24 * HOUR;

export function isWeeklyUsageWindow(windowMinutes: number): boolean {
  return windowMinutes === 7 * DAY;
}

/** "Weekly", "30-day" or "5-hour". */
export function usageWindowLabel(windowMinutes: number): string {
  const days = windowMinutes / DAY;
  if (isWeeklyUsageWindow(windowMinutes)) return t`Weekly`;
  if (Number.isInteger(days)) return t`${days}-day`;
  const hours = Math.round(windowMinutes / HOUR);
  return t`${hours}-hour`;
}

/** A time within the coming days, or a date once the reset is a week or more away. */
export function formatUsageReset(resetsAt: string): string {
  const reset = new Date(resetsAt);
  // A weekday alone is ambiguous once the reset is a week or more away.
  return reset.toLocaleString(
    i18n.locale || "en",
    reset.getTime() - Date.now() < 6 * DAY * 60_000
      ? { weekday: "short", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric" },
  );
}
