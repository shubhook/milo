import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { AgentModel, ModelUsageWindow } from "@milo/contracts";
import { currentUsageWindow } from "@milo/core";
import { Badge, Progress, ProgressLabel, ProgressValue } from "@milo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";

const HOUR = 60;
const DAY = 24 * HOUR;

/** Models the agent runtime runs bots on, with each plan's current usage limits. */
export function AgentModelsPanel() {
  const [models, setModels] = useState<AgentModel[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    rpc.agent
      .models()
      .then((next) => {
        if (active) setModels(next);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-[14px] text-destructive">
        <Trans>Could not load models.</Trans>
      </p>
    );
  }
  if (!models) return null;
  return (
    <ul data-testid="agent-models" className="space-y-3">
      {models.map((model) => (
        <li
          key={model.provider}
          data-testid={`agent-model-${model.provider}`}
          className="rounded-xl border border-border px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-medium text-foreground">{model.label}</h3>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{model.model}</p>
            </div>
            {model.inUse ? (
              <Badge variant="secondary">
                <Trans>In use</Trans>
              </Badge>
            ) : null}
          </div>
          {model.limits.length ? (
            <div className="mt-4 space-y-4">
              {model.limits.map((window) => (
                <UsageWindow key={window.windowMinutes} window={currentUsageWindow(window)} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-muted-foreground">
              <Trans>Limits show after the next run.</Trans>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function UsageWindow({ window }: { window: ModelUsageWindow }) {
  const { t } = useLingui();
  const used = Math.round(window.usedPercent);
  const days = window.windowMinutes / DAY;
  const hours = Math.round(window.windowMinutes / HOUR);
  const label =
    window.windowMinutes === 7 * DAY
      ? t`Weekly`
      : Number.isInteger(days)
        ? t`${days}-day`
        : t`${hours}-hour`;
  const reset = window.resetsAt ? new Date(window.resetsAt) : null;
  // A weekday alone is ambiguous once the reset is a week or more away.
  const resetsAt = reset
    ? reset.toLocaleString(
        i18n.locale || "en",
        reset.getTime() - Date.now() < 6 * DAY * 60_000
          ? { weekday: "short", hour: "numeric", minute: "2-digit" }
          : { month: "short", day: "numeric" },
      )
    : null;
  return (
    <Progress value={window.usedPercent} className="gap-2">
      <ProgressLabel className="text-[13.5px] font-normal text-foreground">{label}</ProgressLabel>
      <ProgressValue className="text-[13px]">{() => t`${used}% used`}</ProgressValue>
      {resetsAt ? (
        <p className="order-last w-full text-[12.5px] text-muted-foreground">
          <Trans>Resets {resetsAt}</Trans>
        </p>
      ) : null}
    </Progress>
  );
}
