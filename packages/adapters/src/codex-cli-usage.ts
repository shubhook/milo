import type { ModelUsageWindow } from "@milo/contracts";
import { type ClaudeCodeSpawn, claudeCodeEnvironment, spawnClaudeCode } from "./claude-code-cli.js";

export const CODEX_CLI_PROVIDER = "codex";

/** The plan the local Codex CLI is signed in to and how much of each window it has used. */
export type CodexUsage = { plan: string | null; windows: ModelUsageWindow[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Windows from an `account/rateLimits/read` snapshot; `resetsAt` is in Unix seconds. */
export function codexRateLimitWindows(snapshot: unknown): ModelUsageWindow[] {
  if (!isRecord(snapshot)) return [];
  return [snapshot.primary, snapshot.secondary].flatMap((window) => {
    if (!isRecord(window) || typeof window.usedPercent !== "number") return [];
    const windowMinutes = Number(window.windowDurationMins);
    if (!Number.isInteger(windowMinutes) || windowMinutes <= 0) return [];
    const resetsAt = Number(window.resetsAt);
    return [
      {
        windowMinutes,
        usedPercent: Math.min(100, Math.max(0, window.usedPercent)),
        resetsAt:
          Number.isFinite(resetsAt) && resetsAt > 0
            ? new Date(resetsAt * 1000).toISOString()
            : null,
      },
    ];
  });
}

/**
 * Asks the Codex CLI on this machine for its plan limits through `codex app-server`.
 * Null when the CLI is missing, signed out, or does not answer in time.
 */
export function readCodexUsage(
  options: {
    binaryPath?: string;
    env?: NodeJS.ProcessEnv;
    spawn?: ClaudeCodeSpawn;
    timeoutMs?: number;
  } = {},
): Promise<CodexUsage | null> {
  const base = options.env ?? process.env;
  const env = claudeCodeEnvironment(base);
  if (base.CODEX_HOME) env.CODEX_HOME = base.CODEX_HOME;
  const spawn = options.spawn ?? spawnClaudeCode;
  return new Promise((resolve) => {
    let settled = false;
    let buffered = "";
    const child = spawn(options.binaryPath ?? "codex", ["app-server"], {
      env,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const finish = (usage: CodexUsage | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(usage);
    };
    const timer = setTimeout(() => finish(null), options.timeoutMs ?? 10_000);
    child.on("error", () => finish(null));
    child.on("close", () => finish(null));
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isRecord(message) || message.id !== 2) continue;
        const snapshot = isRecord(message.result) ? message.result.rateLimits : undefined;
        if (!isRecord(snapshot)) return finish(null);
        finish({
          plan: typeof snapshot.planType === "string" ? snapshot.planType : null,
          windows: codexRateLimitWindows(snapshot),
        });
      }
    });
    const send = (message: Record<string, unknown>) =>
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    child.stdin?.on("error", () => finish(null));
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "milo", version: "1" } } });
    send({ method: "initialized" });
    send({
      id: 2,
      method: "account/rateLimits/read",
      params: { excludeResetCreditDetails: true },
    });
  });
}
