import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot, Routine } from "@milo/contracts";
import { BotAvatar, Button, cn } from "@milo/ui-web";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localTimezone } from "../lib/local-timezone";
import { RoutineDraftError, saveRoutineDraft } from "../lib/routine-save";
import { rpc } from "../lib/rpc";
import {
  draftFromRoutine,
  emptyRoutineDraft,
  type RoutineDraftState,
  RoutineEditor,
  routineTriggerSummary,
} from "./RoutineEditor";
import { DeleteItemDialog } from "./shell/dialogs";

const RUN_POLL_MS = 2_000;

/** Every routine in the space: a list beside the editor. */
export function RoutinesPage() {
  const { t } = useLingui();
  const [bots, setBots] = useState<Bot[]>([]);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutineDraftState>(emptyRoutineDraft());
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const runPoll = useRef<number | null>(null);

  const bot = bots.find((item) => item.id === botId) ?? null;

  async function load() {
    const nextBots = await rpc.bots.list();
    const lists = await Promise.all(
      nextBots.map((item) => rpc.routines.list({ botId: item.id }).catch(() => [])),
    );
    setBots(nextBots);
    setRoutines(lists.flat());
    return { nextBots, nextRoutines: lists.flat() };
  }

  useEffect(() => {
    void load()
      .then(({ nextBots, nextRoutines }) => {
        const first = nextRoutines[0];
        if (first) open(first);
        else startNew(nextBots[0]?.id ?? null);
      })
      .catch(() => setRoutines([]));
    return () => {
      if (runPoll.current) window.clearInterval(runPoll.current);
    };
  }, []);

  function open(routine: Routine) {
    setEditing(routine);
    setBotId(routine.botId);
    setDraft(draftFromRoutine(routine));
    setWebhookSecret(null);
    setError(null);
  }

  function startNew(nextBotId: string | null) {
    setEditing(null);
    setBotId(nextBotId);
    setDraft(emptyRoutineDraft());
    setWebhookSecret(null);
    setError(null);
  }

  async function ensureWebhookSecret() {
    if (!bot) return;
    const result = await rpc.bots.rotateWebhookSecret({ botId: bot.id });
    setWebhookSecret(result.secret);
    setBots((current) =>
      current.map((item) => (item.id === bot.id ? { ...item, webhookConfigured: true } : item)),
    );
  }

  async function save() {
    if (!bot || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveRoutineDraft({
        botId: bot.id,
        editing,
        draft,
        needsWebhookSecret: !bot.webhookConfigured && !webhookSecret,
        ensureWebhookSecret,
      });
      setRoutines((current) => [...(current ?? []).filter((item) => item.id !== saved.id), saved]);
      setEditing(saved);
      setDraft(draftFromRoutine(saved));
    } catch (err) {
      setError(
        err instanceof RoutineDraftError || err instanceof Error
          ? err.message
          : t`Could not save routine`,
      );
    } finally {
      setSaving(false);
    }
  }

  function watchRun(id: string) {
    setRunId(id);
    if (runPoll.current) window.clearInterval(runPoll.current);
    runPoll.current = window.setInterval(() => {
      void rpc.runs
        .list({ filter: "active" })
        .then(({ runs }) => {
          if (runs.some((run) => run.runId === id)) return;
          if (runPoll.current) window.clearInterval(runPoll.current);
          runPoll.current = null;
          setRunId(null);
          void load().catch(() => undefined);
        })
        .catch(() => undefined);
    }, RUN_POLL_MS);
  }

  async function runNow() {
    if (!editing) return;
    setError(null);
    try {
      const started = await rpc.routines.testRun({ routineId: editing.id });
      watchRun(started.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not run routine`);
    }
  }

  async function stop() {
    if (!editing) return;
    await rpc.threads.stop({ botId: editing.botId }).catch(() => undefined);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sorted = [...(routines ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          aria-label={t`Routines`}
          className="flex min-h-0 flex-col border-border md:w-[360px] md:flex-none md:border-e"
        >
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <h1 className="flex-1 text-section font-semibold">
              <Trans>Routines</Trans>
            </h1>
            <Button onClick={() => startNew(bots[0]?.id ?? null)} disabled={bots.length === 0}>
              <Plus />
              <Trans>Create Routine</Trans>
            </Button>
          </div>
          <div className="rk-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-3">
            {sorted.map((routine) => {
              const owner = bots.find((item) => item.id === routine.botId);
              const selected = editing?.id === routine.id;
              return (
                <button
                  key={routine.id}
                  type="button"
                  data-testid="routine-page-row"
                  onClick={() => open(routine)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-start",
                    selected ? "bg-card shadow-raised" : "hover:bg-foreground/5",
                  )}
                >
                  {owner ? <BotAvatar color={owner.color} identity={owner.id} size={32} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 truncate font-medium" dir="auto">
                        {routine.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11.5px]",
                          routine.active
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {routine.active ? <Trans>Active</Trans> : <Trans>Paused</Trans>}
                      </span>
                    </span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">
                      {owner ? `${owner.name} · ` : ""}
                      {routineTriggerSummary(routine)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <main className="rk-scroll min-h-0 flex-1 overflow-y-auto">
          {bot ? (
            <div className="mx-auto w-full max-w-[680px] px-5 py-6 md:px-8">
              <RoutineEditor
                key={editing?.id ?? `new:${bot.id}`}
                draft={draft}
                onChange={setDraft}
                editing={editing}
                timezone={editing?.timezone ?? localTimezone()}
                webhook={{
                  path: `${origin}/api/v1/bots/${bot.id}/webhook`,
                  secret: webhookSecret,
                  configured: bot.webhookConfigured || Boolean(webhookSecret),
                }}
                githubPath={`${origin}/api/v1/bots/${bot.id}/github`}
                saving={saving}
                running={runId !== null}
                error={error}
                onSave={() => void save()}
                onTestRun={() => void runNow()}
                onStop={() => void stop()}
                onDelete={() => (editing ? setDeleteTarget(editing) : startNew(bot.id))}
                onEnsureWebhook={ensureWebhookSecret}
                botPicker={
                  editing ? null : (
                    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                      <legend className="mb-1.5 text-small font-medium text-muted-foreground">
                        <Trans>Bot</Trans>
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {bots.map((item) => (
                          <Button
                            key={item.id}
                            type="button"
                            variant="outline"
                            aria-pressed={item.id === bot.id}
                            onClick={() => setBotId(item.id)}
                            className={cn(
                              "h-9 gap-2 ps-1.5 font-normal",
                              item.id === bot.id && "border-foreground",
                            )}
                          >
                            <BotAvatar color={item.color} identity={item.id} size={24} />
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                  )
                }
              />
            </div>
          ) : null}
        </main>
      </div>
      {deleteTarget ? (
        <DeleteItemDialog
          item={deleteTarget}
          noun="routine"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const target = deleteTarget;
            await rpc.routines.remove({ routineId: target.id });
            setDeleteTarget(null);
            const remaining = (routines ?? []).filter((item) => item.id !== target.id);
            setRoutines(remaining);
            const next = remaining[0];
            if (next) open(next);
            else startNew(bots[0]?.id ?? null);
          }}
        />
      ) : null}
    </div>
  );
}
