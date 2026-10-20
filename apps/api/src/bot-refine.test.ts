import { ScriptedAgentRuntime } from "@milo/adapters";
import { describe, expect, it } from "vitest";
import {
  buildRefinePrompt,
  fallbackRefine,
  parseRefineReply,
  refineBotProfile,
} from "./bot-refine.js";

describe("bot refine", () => {
  it("builds a prompt the scripted runtime can match", () => {
    expect(buildRefinePrompt("Scout", "Find travel deals")).toContain("milo refine bot profile");
    expect(buildRefinePrompt("Scout", "Find travel deals")).toContain("Name: Scout");
  });

  it("falls back when the reply is not JSON", () => {
    expect(parseRefineReply("sorry", "Scout", "Find travel deals.")).toEqual(
      fallbackRefine("Scout", "Find travel deals."),
    );
  });

  it("parses a JSON reply", () => {
    expect(
      parseRefineReply(
        'Here you go:\n{"title":"Travel finder","instructions":"Hunt deals daily."}\n',
        "Scout",
        "Find travel deals",
      ),
    ).toEqual({
      title: "Travel finder",
      instructions: "Hunt deals daily.",
    });
  });

  it("runs through the scripted runtime", async () => {
    const refined = await refineBotProfile(
      new ScriptedAgentRuntime(),
      { name: "Scout", description: "Find travel deals every morning." },
      { provider: "scripted", id: "scripted" },
    );
    expect(refined.title.length).toBeGreaterThan(0);
    expect(refined.instructions).toContain("Find travel deals");
  });
});
