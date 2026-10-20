import { describe, expect, it } from "vitest";
import { countBotsNeedingYou } from "./needs-you";

describe("countBotsNeedingYou", () => {
  it("counts bots waiting on the person or failed", () => {
    expect(
      countBotsNeedingYou([
        { status: "waiting_input" },
        { status: "waiting_takeover" },
        { status: "failed" },
        { status: "running" },
        { status: "idle" },
        {},
      ]),
    ).toBe(3);
  });
});
