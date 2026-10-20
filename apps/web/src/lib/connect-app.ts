import type { ConnectionCatalogItem } from "@milo/contracts";
import { abortableDelay } from "@milo/core";
import { rpc } from "./rpc";

const POLL_ATTEMPTS = 45;
const POLL_INTERVAL_MS = 2_000;

/**
 * Start a catalog app connection, open its sign-in window, and wait for it to finish.
 * Resolves "pending" when the provider has not confirmed after about a minute and a half.
 */
export async function connectCatalogApp(
  item: ConnectionCatalogItem,
  displayName: string,
  signal: AbortSignal,
): Promise<"connected" | "pending" | "aborted"> {
  const started = await rpc.connections.begin({
    connectorId: item.connectorId,
    provider: item.slug,
    displayName,
  });
  if (started.authorizationUrl)
    window.open(started.authorizationUrl, "rakazo-plugin-connect", "noopener,noreferrer");
  if (item.noAuth && !started.authorizationUrl) return signal.aborted ? "aborted" : "connected";
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    if (signal.aborted) return "aborted";
    const row = await rpc.connections
      .complete({ connectionId: started.connectionId })
      .catch(() => undefined);
    if (row?.status === "connected") return signal.aborted ? "aborted" : "connected";
    await abortableDelay(POLL_INTERVAL_MS, signal);
  }
  return signal.aborted ? "aborted" : "pending";
}
