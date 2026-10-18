import { Trans, useLingui } from "@lingui/react/macro";
import type { AgentModel } from "@milo/contracts";
import { exhaustedUsageWindow } from "@milo/core";
import { Button } from "@milo/ui-web";
import { useEffect, useState } from "react";
import type { ChatGptCapture } from "../lib/chatgpt-sign-in";
import { chatGptAvailable, useChatGptSignIn } from "../lib/chatgpt-sign-in";
import { rpc } from "../lib/rpc";
import { formatUsageReset, isWeeklyUsageWindow, usageWindowLabel } from "../lib/usage-window";
import { Shimmer } from "./ai/primitives";

const CLAUDE_CODE = "claude-code";

/**
 * Says when the plan bots run on is out until its window resets. Signing in with ChatGPT
 * is the switch: the runtime runs a person's bots on ChatGPT once it is connected.
 */
export function UsageLimitNotice({ refreshKey }: { refreshKey: unknown }) {
  const { t } = useLingui();
  const [models, setModels] = useState<AgentModel[]>([]);
  const [capture, setCapture] = useState<ChatGptCapture>(null);
  const [, setClock] = useState(0);
  const chatgpt = useChatGptSignIn(() => void load());

  async function load() {
    setModels(await rpc.agent.models().catch(() => []));
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  const blocked = exhaustedUsageWindow(models);
  const offerChatGpt =
    blocked?.model.provider === CLAUDE_CODE &&
    !models.some((model) => model.provider === "chatgpt");

  useEffect(() => {
    if (!offerChatGpt || capture) return;
    let active = true;
    void fetch("/api/auth/capabilities")
      .then((response) => (response.ok ? response.json() : null))
      .then((capabilities: { chatgpt?: ChatGptCapture } | null) => {
        if (active) setCapture(capabilities?.chatgpt ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [offerChatGpt, capture]);

  // Clear the notice when the window resets.
  const resetTime = blocked?.window.resetsAt ? Date.parse(blocked.window.resetsAt) : null;
  useEffect(() => {
    if (resetTime === null) return;
    const timer = window.setTimeout(
      () => setClock((value) => value + 1),
      Math.max(0, Math.min(resetTime - Date.now(), 2 ** 31 - 1)),
    );
    return () => window.clearTimeout(timer);
  }, [resetTime]);

  if (!blocked) return null;
  const { model, window: usage } = blocked;
  const agent = model.label;
  const period = usageWindowLabel(usage.windowMinutes);
  const limit = isWeeklyUsageWindow(usage.windowMinutes)
    ? t`${agent}'s weekly limit is used up.`
    : t`${agent}'s ${period} limit is used up.`;
  const resetsAt = usage.resetsAt ? formatUsageReset(usage.resetsAt) : null;

  return (
    <div
      role="status"
      data-testid="usage-limit-notice"
      className="mb-2 flex flex-wrap items-center gap-3 rounded-2xl bg-destructive-surface py-2.5 ps-4 pe-2.5 text-small text-foreground"
    >
      <span className="min-w-[220px] flex-1">
        {limit}
        {resetsAt ? (
          <>
            {" "}
            <Trans>Resets {resetsAt}</Trans>
          </>
        ) : null}
      </span>
      {offerChatGpt && chatGptAvailable(capture) ? (
        <Button variant="outline" disabled={chatgpt.pending} onClick={() => void chatgpt.start()}>
          {chatgpt.pending ? (
            <Shimmer>
              <Trans>Waiting for ChatGPT…</Trans>
            </Shimmer>
          ) : (
            <Trans>Use ChatGPT</Trans>
          )}
        </Button>
      ) : null}
      {chatgpt.error ? <span className="w-full text-destructive">{chatgpt.error}</span> : null}
    </div>
  );
}
