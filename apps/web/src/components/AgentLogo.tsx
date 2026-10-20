import type { AgentLogo as AgentLogoName } from "@milo/core";
import { AGENT_LOGOS } from "@milo/core";

/** The agent's mark on a bordered tile, as on the onboarding and model cards. */
export function AgentLogo({ agent, size = 40 }: { agent: AgentLogoName; size?: number }) {
  const logo = AGENT_LOGOS[agent];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground"
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        viewBox="0 0 24 24"
        fill={logo.fill ?? "currentColor"}
      >
        <path d={logo.path} />
      </svg>
    </span>
  );
}
