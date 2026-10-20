import { t } from "@lingui/core/macro";
import type { Routine } from "@milo/contracts";
import { cronFromPreset } from "@milo/core";
import { type RoutineDraftState, routineNeedsOneShotArm } from "../pages/RoutineEditor";
import { localTimezone } from "./local-timezone";
import { rpc } from "./rpc";

/** A problem with the draft itself, shown as-is next to the editor. */
export class RoutineDraftError extends Error {}

/**
 * Create or update a routine from the editor draft. Mints the bot's webhook secret
 * first when a webhook or GitHub trigger needs one.
 */
export async function saveRoutineDraft(input: {
  botId: string;
  editing: Routine | null;
  draft: RoutineDraftState;
  needsWebhookSecret: boolean;
  ensureWebhookSecret: () => Promise<unknown>;
}): Promise<Routine> {
  const { botId, editing, draft } = input;
  if (!draft.schedules.length && !draft.webhookEnabled && !draft.githubEnabled) {
    throw new RoutineDraftError(t`Add a schedule, webhook, or GitHub trigger`);
  }
  if ((draft.webhookEnabled || draft.githubEnabled) && input.needsWebhookSecret) {
    await input.ensureWebhookSecret();
  }
  const crons = draft.schedules.map(cronFromPreset);
  if (!editing) {
    return rpc.routines.create({
      botId,
      name: draft.name || t`Routine`,
      prompt: draft.prompt || t`Check in.`,
      crons,
      timezone: localTimezone(),
      active: draft.active,
      notify: true,
      webhookEnabled: draft.webhookEnabled,
      githubEnabled: draft.githubEnabled,
    });
  }
  const armOneShot = routineNeedsOneShotArm(editing, crons);
  let runAt: string | undefined;
  if (armOneShot) {
    if (!draft.runAtLocal) throw new RoutineDraftError(t`Add a run time for this one-shot.`);
    const parsed = new Date(draft.runAtLocal);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      throw new RoutineDraftError(t`Run time must be in the future.`);
    }
    runAt = parsed.toISOString();
  }
  return rpc.routines.update({
    routineId: editing.id,
    name: draft.name || t`Routine`,
    prompt: draft.prompt || t`Check in.`,
    crons,
    active: armOneShot ? true : draft.active,
    webhookEnabled: draft.webhookEnabled,
    githubEnabled: draft.githubEnabled,
    ...(runAt ? { runAt } : {}),
  });
}
