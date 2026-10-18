import { Trans, useLingui } from "@lingui/react/macro";
import type { ConnectionCatalogItem } from "@milo/contracts";
import { buildFeaturedConnectorTiles } from "@milo/core";
import { Button } from "@milo/ui-web";
import { Check, Plug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Shimmer } from "../components/ai/primitives";
import { connectCatalogApp } from "../lib/connect-app";

/** The featured catalog apps, each with Connect. Skipping is always allowed. */
export function OnboardingAppsStep({
  catalog,
  onContinue,
}: {
  catalog: ConnectionCatalogItem[];
  onContinue: () => void;
}) {
  const { t } = useLingui();
  const apps = buildFeaturedConnectorTiles(catalog).flatMap((tile) =>
    tile.item ? [{ label: tile.label, item: tile.item }] : [],
  );
  const [connected, setConnected] = useState<Set<string>>(
    () => new Set(apps.filter((app) => app.item.connected).map((app) => app.item.slug)),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<AbortController | null>(null);

  useEffect(() => () => attempt.current?.abort(), []);

  async function connect(label: string, item: ConnectionCatalogItem) {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    setPending(item.slug);
    setError(null);
    try {
      const outcome = await connectCatalogApp(item, label, controller.signal);
      if (outcome === "connected") setConnected((current) => new Set(current).add(item.slug));
      if (outcome === "pending") setError(t`Connection to ${label} is still pending.`);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : t`Could not connect`);
      }
    } finally {
      if (attempt.current === controller) {
        attempt.current = null;
        setPending(null);
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-7">
      <h1 className="text-center text-title font-semibold tracking-tight text-foreground">
        <Trans>Connect your apps</Trans>
      </h1>
      <ul className="m-0 w-full max-w-[520px] list-none rounded-[20px] border border-border bg-card px-[18px] py-1.5">
        {apps.map(({ label, item }, index) => (
          <li
            key={item.slug}
            className={`flex items-center gap-3.5 py-3 ${index < apps.length - 1 ? "border-b border-border" : ""}`}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground"
            >
              {item.logo ? (
                <img src={item.logo} alt="" className="size-5 object-contain" />
              ) : (
                <Plug size={18} strokeWidth={1.8} />
              )}
            </span>
            <span className="flex-1 font-medium text-foreground">{label}</span>
            {connected.has(item.slug) ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <Check size={16} strokeWidth={2} aria-hidden="true" />
                <Trans>Connected</Trans>
              </span>
            ) : pending === item.slug ? (
              <Shimmer>
                <Trans>Connecting…</Trans>
              </Shimmer>
            ) : (
              <Button
                variant="outline"
                disabled={pending !== null}
                aria-label={t`Connect ${label}`}
                onClick={() => void connect(label, item)}
              >
                <Trans>Connect</Trans>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="ghost" size="lg" onClick={onContinue}>
          <Trans>Skip for now</Trans>
        </Button>
        <Button size="lg" className="px-5" disabled={connected.size === 0} onClick={onContinue}>
          <Trans>Continue</Trans>
        </Button>
      </div>
    </div>
  );
}
