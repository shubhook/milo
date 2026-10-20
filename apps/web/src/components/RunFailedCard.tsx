import { Trans } from "@lingui/react/macro";
import type { AgentStatus, RunFailureFix } from "@milo/contracts";
import { Button, Dialog, DialogContent, DialogTitle } from "@milo/ui-web";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";
import { OnboardingAgentStep } from "../pages/OnboardingAgent";

/** A failed run stays in the thread; when the error names a fix, the card offers it. */
export function RunFailedCard({ error, fix }: { error: string; fix: RunFailureFix | null }) {
  // Only the deployment owner can sign the agent in, and only they get its status.
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (fix !== "agent_sign_in") return;
    let active = true;
    void rpc.agent
      .status()
      .then((status) => {
        if (active) setAgent(status);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [fix]);

  return (
    <div
      role="status"
      data-testid="run-failed-card"
      className="flex w-full max-w-[720px] flex-wrap items-start gap-2.5 rounded-2xl bg-destructive-surface px-4 py-3 text-small text-foreground"
    >
      <TriangleAlert
        size={16}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0 text-destructive"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1" dir="auto">
        {error}
      </span>
      {fix === "agent_sign_in" && agent ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Trans>Sign in again</Trans>
        </Button>
      ) : null}
      {open && agent ? (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="w-[min(720px,calc(100%-2rem))] sm:max-w-none">
            <DialogTitle className="sr-only">
              <Trans>Sign in again</Trans>
            </DialogTitle>
            <OnboardingAgentStep initialStatus={agent} onContinue={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
