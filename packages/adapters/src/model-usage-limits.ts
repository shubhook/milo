import type { ModelUsageWindow } from "@milo/contracts";
import type { PrismaClient } from "@milo/db";

const FIVE_HOURS = 5 * 60;
const ONE_WEEK = 7 * 24 * 60;
/** Claude Code's unified windows; per-model weekly windows are left out. */
const CLAUDE_WINDOWS: Record<string, number> = { five_hour: FIVE_HOURS, seven_day: ONE_WEEK };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function percent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function isoFromSeconds(value: unknown): string | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/** Plan windows from a Claude Code `rate_limit_event`, where utilization is a 0–1 fraction. */
export function claudeCodeUsageLimits(message: Record<string, unknown>): ModelUsageWindow[] {
  const info = message.rate_limit_info;
  const windows = isRecord(info) ? info.unifiedWindows : undefined;
  if (!isRecord(windows)) return [];
  return Object.entries(CLAUDE_WINDOWS).flatMap(([name, windowMinutes]) => {
    const window = windows[name];
    if (!isRecord(window) || typeof window.utilization !== "number") return [];
    return [
      {
        windowMinutes,
        usedPercent: percent(window.utilization * 100),
        resetsAt: isoFromSeconds(window.resetsAt),
      },
    ];
  });
}

/** Plan windows from the `x-codex-{primary,secondary}-*` headers on a ChatGPT plan response. */
export function codexUsageLimits(
  headers: Record<string, string>,
  now: number = Date.now(),
): ModelUsageWindow[] {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return (["primary", "secondary"] as const).flatMap((slot) => {
    const prefix = `x-codex-${slot}-`;
    const used = Number(lower[`${prefix}used-percent`]);
    const windowMinutes = Number(lower[`${prefix}window-minutes`]);
    if (!Number.isFinite(used) || !Number.isInteger(windowMinutes) || windowMinutes <= 0) {
      return [];
    }
    const after = Number(lower[`${prefix}reset-after-seconds`]);
    const resetsAt =
      isoFromSeconds(lower[`${prefix}reset-at`]) ??
      (Number.isFinite(after) && after >= 0 ? new Date(now + after * 1000).toISOString() : null);
    return [{ windowMinutes, usedPercent: percent(used), resetsAt }];
  });
}

export async function saveModelUsageLimits(
  prisma: PrismaClient,
  userId: string,
  provider: string,
  windows: ModelUsageWindow[],
): Promise<void> {
  await prisma.modelUsageLimit.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, windows },
    update: { windows },
  });
}
