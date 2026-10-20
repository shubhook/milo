import { Trans, useLingui } from "@lingui/react/macro";
import type { AgentModel, ModelUsageWindow } from "@milo/contracts";
import { agentLogoForProvider, currentUsageWindow, usageWindowTone } from "@milo/core";
import { Badge, cn, Progress, ProgressLabel, ProgressValue } from "@milo/ui-web";
import { useEffect, useState } from "react";
import { AgentLogo } from "../components/AgentLogo";
import { rpc } from "../lib/rpc";
import { formatUsageReset, usageWindowLabel } from "../lib/usage-window";

const METER_TONE_CLASS = {
  normal: "",
  warning: "[&_[data-slot=progress-indicator]]:bg-warning",
  destructive: "[&_[data-slot=progress-indicator]]:bg-destructive",
} as const;

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
  if (!models) {
    return (
      <p className="text-[14px] text-muted-foreground">
        <Trans>Loading…</Trans>
      </p>
    );
  }
  return (
    <ul data-testid="agent-models" className="m-0 list-none p-0">
      {models.map((model) => {
        const logo = agentLogoForProvider(model.provider);
        return (
          <li
            key={model.provider}
            data-testid={`agent-model-${model.provider}`}
            className="border-b border-border py-3.5 last:border-b-0"
          >
            <div className="flex items-center gap-3.5">
              {logo ? <AgentLogo agent={logo} size={36} /> : null}
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground">{model.label}</h3>
                {model.model ? (
                  <p className="truncate text-[12.5px] text-muted-foreground">{model.model}</p>
                ) : null}
              </div>
              {model.inUse ? (
                <Badge variant="secondary">
                  <Trans>In use</Trans>
                </Badge>
              ) : null}
            </div>
            {model.limits.length ? (
              <div className={cn("mt-3.5 space-y-3.5", logo && "ps-[50px]")}>
                {model.limits.map((window) => (
                  <UsageWindow key={window.windowMinutes} window={currentUsageWindow(window)} />
                ))}
              </div>
            ) : (
              <p className={cn("mt-2 text-[12.5px] text-muted-foreground", logo && "ps-[50px]")}>
                <Trans>Limits show after the next run.</Trans>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function UsageWindow({ window }: { window: ModelUsageWindow }) {
  const { t } = useLingui();
  const used = Math.round(window.usedPercent);
  const tone = usageWindowTone(window.usedPercent);
  const label = usageWindowLabel(window.windowMinutes);
  const resetsAt = window.resetsAt ? formatUsageReset(window.resetsAt) : null;
  return (
    <Progress
      value={window.usedPercent}
      data-tone={tone}
      className={cn("gap-2", METER_TONE_CLASS[tone])}
    >
      <ProgressLabel className="text-small font-normal text-foreground">{label}</ProgressLabel>
      <ProgressValue
        className={cn(
          "text-small",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
        )}
      >
        {() => t`${used}% used`}
      </ProgressValue>
      {resetsAt ? (
        <p className="order-last w-full text-[12.5px] text-muted-foreground">
          <Trans>Resets {resetsAt}</Trans>
        </p>
      ) : null}
    </Progress>
  );
}
