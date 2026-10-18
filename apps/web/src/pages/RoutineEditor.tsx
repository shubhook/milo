import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { Routine } from "@milo/contracts";
import {
  type CronFreq,
  type CronPreset,
  cronFromPreset,
  defaultCronPreset,
  formatCron,
  isOneShotRoutineCrons,
  presetFromCron,
} from "@milo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Switch,
  Textarea,
} from "@milo/ui-web";
import { ChevronLeft, Clock, GitBranch, Globe, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Shimmer } from "../components/ai/primitives";
import { RoutineRunHistory } from "./RoutineRunHistory";
import { RoutineSchedule } from "./RoutineSchedule";

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultArmRunAtLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
}

export function routineNeedsOneShotArm(
  routine: Pick<Routine, "nextRunAt" | "lastRunAt">,
  crons: string[],
) {
  return isOneShotRoutineCrons(crons) && !routine.nextRunAt && !routine.lastRunAt;
}

const SCHEDULE_PRESETS: CronFreq[] = [
  "Every hour",
  "Every day",
  "Weekdays",
  "Every week",
  "Every month",
  "Interval",
  "Advanced",
];

const COMING_SOON = [
  { id: "linear", label: () => t`Linear issue` },
  { id: "sentry", label: () => t`Sentry alert` },
  { id: "pagerduty", label: () => t`PagerDuty incident` },
] as const;

export type RoutineDraftState = {
  name: string;
  prompt: string;
  schedules: CronPreset[];
  webhookEnabled: boolean;
  githubEnabled: boolean;
  active: boolean;
  runAtLocal: string;
};

export function emptyRoutineDraft(): RoutineDraftState {
  return {
    name: "",
    prompt: "",
    schedules: [],
    webhookEnabled: false,
    githubEnabled: false,
    active: true,
    runAtLocal: "",
  };
}

export function draftFromRoutine(routine: Routine): RoutineDraftState {
  return {
    name: routine.name,
    prompt: routine.prompt,
    schedules: routine.crons.map(presetFromCron),
    webhookEnabled: routine.webhookEnabled,
    githubEnabled: routine.githubEnabled,
    active: routine.active,
    runAtLocal: routineNeedsOneShotArm(routine, routine.crons) ? defaultArmRunAtLocal() : "",
  };
}

const ROUTINE_LABEL_CLASS = "flex flex-col gap-1.5 text-small font-medium text-muted-foreground";

export function routineTriggerSummary(routine: Routine): string {
  if (!routine.active) return t`Paused`;
  const parts: string[] = [];
  if (routine.webhookEnabled) parts.push(t`When a webhook fires`);
  if (routine.githubEnabled) parts.push(t`Git event`);
  for (const cron of routine.crons) parts.push(formatCron(cron));
  return parts.length > 0 ? parts.join(" · ") : t`No trigger`;
}

export function RoutineListHeader({ onCreate }: { onCreate: () => void }) {
  const { t } = useLingui();
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <h3 className="text-[12px] font-medium text-muted-foreground">
        <Trans>Routines</Trans>
      </h3>
      <Button
        variant="secondary"
        size="icon-sm"
        data-testid="routine-create-button"
        aria-label={t`Create Routine`}
        title={t`Create Routine`}
        onClick={onCreate}
      >
        <Plus strokeWidth={1.9} />
      </Button>
    </div>
  );
}

export function RoutineListRow({
  routine,
  running,
  onOpen,
  onStop,
}: {
  routine: Routine;
  running: boolean;
  onOpen: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 hover:bg-accent">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="grid h-5 w-5 place-items-center">
          {routine.active ? (
            <Clock size={16} strokeWidth={1.6} className="text-success" aria-hidden />
          ) : (
            <Pause size={14} className="text-muted-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium text-foreground" dir="auto">
            {routine.name}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground/80">
            {routineTriggerSummary(routine)}
          </span>
        </span>
      </button>
      {running ? (
        <Button size="xs" onClick={onStop} variant="outline" className="shrink-0">
          <Trans>Running · Stop</Trans>
        </Button>
      ) : null}
    </div>
  );
}

export function RoutineEditor({
  draft,
  onChange,
  editing,
  timezone,
  webhook,
  githubPath,
  saving,
  running,
  error,
  onBack,
  onClose,
  onSave,
  onTestRun,
  onStop,
  onDelete,
  onEnsureWebhook,
  botPicker,
}: {
  draft: RoutineDraftState;
  onChange: (next: RoutineDraftState) => void;
  editing: Routine | null;
  timezone: string;
  webhook: { path: string; secret: string | null; configured: boolean };
  githubPath: string;
  saving: boolean;
  running: boolean;
  error: string | null;
  /** Side panel only: the routines page has no back or close. */
  onBack?: () => void;
  onClose?: () => void;
  onSave: () => void;
  onTestRun: () => void;
  /** Shown as "Stop" while a run started from here is going. */
  onStop?: () => void;
  onDelete: () => void;
  onEnsureWebhook: () => Promise<void>;
  /** Picks the bot for a new routine. Saved routines keep their bot. */
  botPicker?: ReactNode;
}) {
  const { t } = useLingui();
  const fieldId = useId();
  const hasTriggers = draft.schedules.length > 0 || draft.webhookEnabled || draft.githubEnabled;
  const canTest = Boolean(editing) && !saving && !running;
  const needsOneShotArm =
    editing != null && routineNeedsOneShotArm(editing, draft.schedules.map(cronFromPreset));

  function addSchedule(freq: CronFreq) {
    const base = defaultCronPreset();
    const next: CronPreset =
      freq === "Advanced" ? { ...base, freq, cron: cronFromPreset(base) } : { ...base, freq };
    onChange({ ...draft, schedules: [...draft.schedules, next] });
  }

  async function addWebhook() {
    onChange({ ...draft, webhookEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  async function addGithub() {
    onChange({ ...draft, githubEnabled: true });
    if (!webhook.configured) {
      await onEnsureWebhook().catch(() => undefined);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {onBack && onClose ? (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="text-muted-foreground"
            aria-label={t`Back`}
          >
            <ChevronLeft />
          </Button>
          <div className="font-medium text-foreground">
            <Trans>Routine</Trans>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground"
            aria-label={t`Close`}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2.5 text-foreground">
          <Switch
            aria-label={t`Active`}
            checked={draft.active}
            onCheckedChange={(checked) => onChange({ ...draft, active: checked })}
          />
          <span aria-hidden="true">
            {draft.active ? <Trans>Active</Trans> : <Trans>Paused</Trans>}
          </span>
        </div>
        {running ? (
          <>
            <Shimmer>{t`Running…`}</Shimmer>
            {onStop ? (
              <Button variant="outline" size="lg" onClick={onStop}>
                <Trans>Stop</Trans>
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="outline" size="lg" disabled={!canTest} onClick={onTestRun}>
            <Play />
            <Trans>Run now</Trans>
          </Button>
        )}
        <Button
          size="lg"
          className="px-4"
          disabled={saving || running || !hasTriggers}
          onClick={onSave}
        >
          {saving ? t`Saving…` : t`Save`}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={t`Delete`}
          disabled={saving || running}
          onClick={onDelete}
          className="text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="-mt-2 text-small text-destructive">
          {error}
        </p>
      ) : null}

      <label htmlFor={`${fieldId}-name`} className={ROUTINE_LABEL_CLASS}>
        <Trans>Name</Trans>
        <Input
          id={`${fieldId}-name`}
          value={draft.name}
          placeholder={t`Name this routine`}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      {botPicker}

      <label htmlFor={`${fieldId}-prompt`} className={ROUTINE_LABEL_CLASS}>
        <Trans>Instruction</Trans>
        <Textarea
          id={`${fieldId}-prompt`}
          value={draft.prompt}
          placeholder={t`What should this routine do each time it runs?`}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          rows={4}
        />
      </label>

      <div className="text-small text-muted-foreground">
        <div className="flex items-baseline gap-2 font-medium">
          <Trans>When to run</Trans>
          <span className="text-xs font-normal text-muted-foreground/70">{timezone}</span>
        </div>

        <div className="mt-2 space-y-2">
          {draft.schedules.map((preset, index) => (
            <div key={index} className="relative">
              <RoutineSchedule
                value={preset}
                onChange={(next) =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.map((item, i) => (i === index ? next : item)),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t`Remove schedule`}
                onClick={() =>
                  onChange({
                    ...draft,
                    schedules: draft.schedules.filter((_, i) => i !== index),
                  })
                }
                className="absolute top-2 right-2 text-muted-foreground"
              >
                <X />
              </Button>
            </div>
          ))}

          {draft.webhookEnabled ? (
            <InboundTriggerCard
              kind="webhook"
              saved={Boolean(editing)}
              path={webhook.path}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, webhookEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {draft.githubEnabled ? (
            <InboundTriggerCard
              kind="github"
              saved={Boolean(editing)}
              path={githubPath}
              secret={webhook.secret}
              configured={webhook.configured}
              onRemove={() => onChange({ ...draft, githubEnabled: false })}
              onRotate={() => void onEnsureWebhook()}
            />
          ) : null}

          {needsOneShotArm ? (
            <label htmlFor={`${fieldId}-run-at`} className="block text-sm text-muted-foreground">
              <Trans>Run at</Trans>
              <Input
                id={`${fieldId}-run-at`}
                type="datetime-local"
                value={draft.runAtLocal}
                onChange={(e) => onChange({ ...draft, runAtLocal: e.target.value })}
                aria-label={t`Run at`}
                className="mt-2"
              />
            </label>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="lg" className="mt-2.5 px-3.5" />}
          >
            <Plus />
            <Trans>Add trigger</Trans>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock />
                <Trans>On a schedule</Trans>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[170px]">
                {SCHEDULE_PRESETS.map((freq) => (
                  <DropdownMenuItem key={freq} onClick={() => addSchedule(freq)}>
                    {schedulePresetLabel(freq)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {COMING_SOON.map((item) => (
              <span key={item.id} className="block" title={t`Coming soon`}>
                <DropdownMenuItem disabled>
                  <span
                    aria-hidden
                    className="inline-block size-3.5 rounded-[4px]"
                    style={{ background: comingSoonColor(item.id), opacity: 0.55 }}
                  />
                  {item.label()}
                </DropdownMenuItem>
              </span>
            ))}

            <DropdownMenuItem disabled={draft.githubEnabled} onClick={() => void addGithub()}>
              <GitBranch />
              <Trans>Git event</Trans>
            </DropdownMenuItem>

            <DropdownMenuItem disabled={draft.webhookEnabled} onClick={() => void addWebhook()}>
              <Globe />
              <Trans>Webhook</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {!hasTriggers ? (
          <p className="mt-2 text-xs text-muted-foreground/70">
            <Trans>Add a schedule, webhook, or GitHub trigger to run this routine.</Trans>
          </p>
        ) : null}
      </div>

      {editing ? <RoutineRunHistory key={editing.id} routineId={editing.id} /> : null}
    </div>
  );
}

function InboundTriggerCard({
  kind,
  saved,
  path,
  secret,
  configured,
  onRemove,
  onRotate,
}: {
  kind: "webhook" | "github";
  saved: boolean;
  path: string;
  secret: string | null;
  configured: boolean;
  onRemove: () => void;
  onRotate: () => void;
}) {
  const { t } = useLingui();
  const pending = !saved;
  const placeholder = t`Available after the routine is saved`;
  // GitHub delivery URL and signature header are fixed by bot id / protocol, so show
  // them before save. The shared secret still needs a saved routine to mint.
  const postValue = kind === "github" || !pending ? path : placeholder;
  const keyValue = pending
    ? placeholder
    : (secret ?? (configured ? t`Saved. Rotate to reveal.` : placeholder));
  const headerValue =
    kind === "github"
      ? "X-Hub-Signature-256: sha256=…"
      : pending
        ? placeholder
        : secret
          ? `Authorization: Bearer ${secret}`
          : configured
            ? "Authorization: Bearer …"
            : placeholder;
  const cellClass =
    "break-all rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground/75";

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2.5 px-0.5">
        {kind === "github" ? (
          <GitBranch size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        ) : (
          <Globe size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden />
        )}
        <span className="flex-1 text-[14.5px] text-foreground">
          {kind === "github" ? <Trans>Git event</Trans> : <Trans>When a webhook fires</Trans>}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={kind === "github" ? t`Remove Git event` : t`Remove webhook`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      <div className="mt-2.5 space-y-2.5 text-[13.5px]">
        <div className="block text-muted-foreground/70">
          <Trans>POST to</Trans>
          <div className={`mt-1 ${cellClass}`}>{postValue}</div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <span className="shrink-0">
            <Trans>key</Trans>
          </span>
          <div className={`min-w-0 flex-1 ${cellClass}`}>{keyValue}</div>
        </div>
        <div className="block text-muted-foreground/70">
          <Trans>header</Trans>
          <div className={`mt-1 ${cellClass}`}>{headerValue}</div>
        </div>
        {saved && configured && !secret ? (
          <Button
            variant="link"
            size="xs"
            onClick={onRotate}
            className="px-0 text-muted-foreground"
          >
            <Trans>Rotate key</Trans>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function schedulePresetLabel(freq: CronFreq): string {
  switch (freq) {
    case "Every hour":
      return t`Every hour`;
    case "Every day":
      return t`Every day`;
    case "Weekdays":
      return t`Weekdays`;
    case "Every week":
      return t`Every week`;
    case "Every month":
      return t`Every month`;
    case "Interval":
      return t`Interval`;
    case "Advanced":
      return t`Advanced...`;
    default:
      return freq;
  }
}

function comingSoonColor(id: string): string {
  switch (id) {
    case "linear":
      return "#5E6AD2";
    case "sentry":
      return "#A467FD";
    default:
      return "#06AC38";
  }
}
