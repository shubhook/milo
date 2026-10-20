import { botAvatarStatusTone } from "@milo/core";
import { useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set<() => void>();

/** Bots waiting on the person or stopped on a failure. */
export function countBotsNeedingYou(bots: readonly { status?: string }[]): number {
  return bots.filter((bot) => botAvatarStatusTone(bot.status) !== null).length;
}

/** The Bots list reports its count here so the tab bar can badge it. */
export function setNeedsYouCount(next: number): void {
  if (next === count) return;
  count = next;
  for (const listener of listeners) listener();
}

export function useNeedsYouCount(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => count,
    () => count,
  );
}
