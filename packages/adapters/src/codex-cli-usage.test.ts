import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { codexRateLimitWindows, readCodexUsage } from "./codex-cli-usage.js";

function fakeAppServer(reply: (request: { id?: number; method: string }) => unknown) {
  const child = new EventEmitter() as ChildProcess;
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  Object.assign(child, { stdin, stdout, kill: () => true });
  let buffered = "";
  stdin.on("data", (chunk: Buffer) => {
    buffered += chunk.toString();
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      const answer = reply(JSON.parse(line));
      if (answer !== undefined) stdout.write(`${JSON.stringify(answer)}\n`);
    }
  });
  return () => child;
}

describe("codexRateLimitWindows", () => {
  it("reads both windows and skips ones without a duration", () => {
    expect(
      codexRateLimitWindows({
        primary: { usedPercent: 3, windowDurationMins: 43_200, resetsAt: 1_794_286_722 },
        secondary: { usedPercent: 50, windowDurationMins: null, resetsAt: null },
      }),
    ).toEqual([{ windowMinutes: 43_200, usedPercent: 3, resetsAt: "2026-11-10T04:58:42.000Z" }]);
  });
});

describe("readCodexUsage", () => {
  it("asks app-server for the plan's rate limits", async () => {
    const methods: string[] = [];
    const spawn = fakeAppServer((request) => {
      methods.push(request.method);
      if (request.id === 1) return { id: 1, result: {} };
      if (request.id === 2) {
        return {
          id: 2,
          result: {
            rateLimits: {
              planType: "plus",
              primary: { usedPercent: 40, windowDurationMins: 300, resetsAt: null },
            },
          },
        };
      }
      return undefined;
    });

    await expect(readCodexUsage({ spawn, env: {} })).resolves.toEqual({
      plan: "plus",
      windows: [{ windowMinutes: 300, usedPercent: 40, resetsAt: null }],
    });
    expect(methods).toEqual(["initialize", "initialized", "account/rateLimits/read"]);
  });

  it("gives up when the CLI is signed out or silent", async () => {
    const signedOut = fakeAppServer((request) =>
      request.id === 2 ? { id: 2, error: { code: -32600, message: "not signed in" } } : undefined,
    );
    await expect(readCodexUsage({ spawn: signedOut, env: {} })).resolves.toBeNull();
    const silent = fakeAppServer(() => undefined);
    await expect(readCodexUsage({ spawn: silent, env: {}, timeoutMs: 20 })).resolves.toBeNull();
  });
});
