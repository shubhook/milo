import { describe, expect, it } from "vitest";
import { claudeCodeUsageLimits, codexUsageLimits } from "./model-usage-limits.js";

describe("claudeCodeUsageLimits", () => {
  it("reads the 5-hour and weekly windows from a rate_limit_event", () => {
    expect(
      claudeCodeUsageLimits({
        type: "rate_limit_event",
        rate_limit_info: {
          status: "allowed",
          unifiedWindows: {
            five_hour: { utilization: 0.47, resetsAt: 1_791_897_000 },
            seven_day: { utilization: 0.06, resetsAt: 1_792_472_400 },
            seven_day_opus: { utilization: 0.9, resetsAt: 1_792_472_400 },
          },
        },
      }),
    ).toEqual([
      { windowMinutes: 300, usedPercent: 47, resetsAt: "2026-10-13T13:10:00.000Z" },
      { windowMinutes: 10_080, usedPercent: 6, resetsAt: "2026-10-20T05:00:00.000Z" },
    ]);
  });

  it("returns nothing for an event without windows", () => {
    expect(claudeCodeUsageLimits({ type: "rate_limit_event", rate_limit_info: {} })).toEqual([]);
    expect(claudeCodeUsageLimits({ type: "rate_limit_event" })).toEqual([]);
  });
});

describe("codexUsageLimits", () => {
  it("reads primary and secondary windows in any header casing", () => {
    expect(
      codexUsageLimits(
        {
          "X-Codex-Primary-Used-Percent": "12.5",
          "x-codex-primary-window-minutes": "300",
          "x-codex-primary-reset-at": "1791897000",
          "x-codex-secondary-used-percent": "140",
          "x-codex-secondary-window-minutes": "10080",
          "x-codex-secondary-reset-after-seconds": "60",
        },
        Date.parse("2026-10-13T12:00:00.000Z"),
      ),
    ).toEqual([
      { windowMinutes: 300, usedPercent: 12.5, resetsAt: "2026-10-13T13:10:00.000Z" },
      { windowMinutes: 10_080, usedPercent: 100, resetsAt: "2026-10-13T12:01:00.000Z" },
    ]);
  });

  it("ignores responses without plan headers", () => {
    expect(codexUsageLimits({ "content-type": "text/event-stream" })).toEqual([]);
    expect(codexUsageLimits({ "x-codex-primary-used-percent": "10" })).toEqual([]);
  });
});
