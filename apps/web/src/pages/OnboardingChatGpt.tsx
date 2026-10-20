import { Trans, useLingui } from "@lingui/react/macro";
import { Button, cn } from "@milo/ui-web";
import { Shimmer } from "../components/ai/primitives";
import type { ChatGptConnected } from "../lib/chatgpt-sign-in";
import { useChatGptSignIn } from "../lib/chatgpt-sign-in";

const ONBOARDING_STEPS = 3;

/** Progress through sign-in, meeting the first bot, and connecting apps. */
export function OnboardingDots({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useLingui();
  return (
    <div
      role="img"
      aria-label={t`Step ${step} of ${ONBOARDING_STEPS}`}
      className="flex justify-center gap-1.5"
    >
      {Array.from({ length: ONBOARDING_STEPS }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 rounded-full transition-all",
            index + 1 === step ? "w-5 bg-foreground" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  );
}

/**
 * The only way in: one ChatGPT sign-in. Signed out, it signs in or creates the
 * account; signed in, it links the plan the account's bots run on.
 */
export function ChatGptStep({ onConnected }: { onConnected: (result: ChatGptConnected) => void }) {
  const chatgpt = useChatGptSignIn(onConnected);
  return (
    <div className="flex flex-col items-center gap-7">
      <OnboardingDots step={1} />
      <h1 className="text-center text-title font-semibold tracking-tight text-foreground">
        <Trans>Sign in with ChatGPT</Trans>
      </h1>
      {chatgpt.error ? (
        <p role="alert" className="text-small text-destructive">
          {chatgpt.error}
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="h-12 w-full max-w-[320px] rounded-xl text-base"
        disabled={chatgpt.pending}
        onClick={() => void chatgpt.start()}
      >
        {chatgpt.pending ? (
          <Shimmer>
            <Trans>Waiting for ChatGPT…</Trans>
          </Shimmer>
        ) : (
          <Trans>Continue</Trans>
        )}
      </Button>
    </div>
  );
}
