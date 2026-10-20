import { t } from "@lingui/core/macro";

/**
 * Short sidebar label while a bot is queued, starting, or running. A running bot shows what its
 * run says it is doing when there is a line. Null keeps the message preview.
 */
export function rosterWorkStatusLabel(status: string, statusLine?: string | null): string | null {
  switch (status) {
    case "queued":
      return t`Waiting in line…`;
    case "leased":
      return t`Starting…`;
    case "running":
      return statusLine?.trim() || t`Working…`;
    default:
      return null;
  }
}
