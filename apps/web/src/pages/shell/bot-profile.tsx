import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, Routine, RunActivityRow } from "@milo/contracts";
import { Button, Tabs, TabsList, TabsTrigger } from "@milo/ui-web";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { formatRelativeTime } from "../../lib/relative-time";
import { statusLabel, statusTone, useRunActivity } from "../ActivityList";
import { RoutineListHeader, RoutineListRow } from "../RoutineEditor";
import { AvatarStudioPopover } from "./avatar-studio-popover";

export type BotProfileTab = "activity" | "computer" | "settings";

/** The profile panel's top: close, the bot's avatar, name and title, then its tabs. */
export function BotProfileHeader({
  bot,
  tab,
  actions,
  onTab,
  onColorChange,
  onClose,
}: {
  bot: Bot;
  tab: BotProfileTab;
  actions?: ReactNode;
  onTab: (tab: BotProfileTab) => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <div className="-mx-5 -mt-[17px] mb-4 border-b border-border">
      <div className="flex justify-end gap-1 px-2.5 pt-2.5">
        {actions}
        <Button variant="ghost" size="icon-sm" aria-label={t`Close panel`} onClick={onClose}>
          <X size={16} strokeWidth={1.8} />
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2 px-5 pb-4">
        <AvatarStudioPopover
          value={bot.color}
          identity={bot.id}
          status={bot.status}
          size={76}
          onChange={onColorChange}
        />
        <span className="max-w-full truncate text-[17px] font-semibold" dir="auto">
          {bot.name}
        </span>
        {bot.title ? (
          <span className="max-w-full truncate text-small text-muted-foreground" dir="auto">
            {bot.title}
          </span>
        ) : null}
      </div>
      <Tabs value={tab} onValueChange={(value) => onTab(value as BotProfileTab)}>
        <TabsList variant="line" className="h-auto w-full justify-start gap-4 px-5">
          <TabsTrigger value="activity" className="flex-none px-0 pb-2.5">
            <Trans>Activity</Trans>
          </TabsTrigger>
          <TabsTrigger value="computer" className="flex-none px-0 pb-2.5">
            <Trans>Computer</Trans>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-0 pb-2.5">
            <Trans>Settings</Trans>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

/** What the bot is doing now, what it runs on a schedule, and what it finished lately. */
export function BotActivity({
  botId,
  routines,
  runningRoutineId,
  onCreateRoutine,
  onOpenRoutine,
  onStopRoutine,
}: {
  botId: string;
  routines: Routine[];
  runningRoutineId: string | null;
  onCreateRoutine: () => void;
  onOpenRoutine: (routine: Routine) => void;
  onStopRoutine: () => void;
}) {
  const { activeRuns, recentRuns } = useRunActivity();
  const ongoing = activeRuns.filter((run) => run.botId === botId);
  const done = recentRuns.filter((run) => run.botId === botId);
  return (
    <div data-testid="bot-activity" className="flex flex-col gap-[18px]">
      {ongoing.length > 0 ? (
        <ActivityGroup label={<Trans>Now</Trans>}>
          {ongoing.map((run) => (
            <RunCard key={run.runId} run={run} />
          ))}
        </ActivityGroup>
      ) : null}
      <div>
        <RoutineListHeader onCreate={onCreateRoutine} />
        {routines.map((routine) => (
          <RoutineListRow
            key={routine.id}
            routine={routine}
            running={runningRoutineId === routine.id}
            onOpen={() => onOpenRoutine(routine)}
            onStop={onStopRoutine}
          />
        ))}
      </div>
      {done.length > 0 ? (
        <ActivityGroup label={<Trans>Recent</Trans>}>
          {done.map((run) => (
            <RunCard key={run.runId} run={run} />
          ))}
        </ActivityGroup>
      ) : null}
    </div>
  );
}

function ActivityGroup({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[12px] font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

function RunCard({ run }: { run: RunActivityRow }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="truncate font-medium" dir="auto">
        {run.promptSnippet || statusLabel(run.status)}
      </span>
      <span className="text-[12.5px] text-muted-foreground">
        <span className={statusTone(run.status, run.updatedAt)}>{statusLabel(run.status)}</span>
        {` · ${formatRelativeTime(run.updatedAt)}`}
      </span>
    </div>
  );
}
