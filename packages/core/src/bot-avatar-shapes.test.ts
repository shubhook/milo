import { BOT_AVATAR_SHAPE_COUNT, parseBotAvatarValue } from "@milo/contracts";
import { describe, expect, it } from "vitest";
import {
  BOT_AVATAR_SHAPES,
  botAvatarEyes,
  botAvatarShape,
  botAvatarShapeIndexForIdentity,
  botAvatarStatusTone,
} from "./bot-avatar-shapes.js";

describe("bot avatar shapes", () => {
  it("keeps the shapes the parser encodes", () => {
    expect(BOT_AVATAR_SHAPES).toHaveLength(BOT_AVATAR_SHAPE_COUNT);
    expect(botAvatarShape(2).key).toBe("dome");
    expect(botAvatarShape(-1).key).toBe("tile");
  });

  it("maps shapes saved before there were four onto N mod 4", () => {
    const parsed = parseBotAvatarValue("#8B5CF6::shape_7");
    expect(parsed).toEqual({ kind: "shape", color: "#8B5CF6", shapeIndex: 3 });
    expect(botAvatarShape(7)).toBe(botAvatarShape(3));
  });

  it("gives a bot without a saved shape the same shape every time", () => {
    const index = botAvatarShapeIndexForIdentity("bot_123");
    expect(index).toBe(botAvatarShapeIndexForIdentity("bot_123"));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(BOT_AVATAR_SHAPES.length);
  });

  it("scales the eyes with the avatar", () => {
    expect(botAvatarEyes(32)).toEqual({ width: 4, height: 6, gap: 3, radius: 2 });
    expect(botAvatarEyes(64)).toEqual({ width: 8, height: 12, gap: 6, radius: 4 });
  });

  it("marks waiting runs as needing you and failed runs as failed", () => {
    expect(botAvatarStatusTone("waiting_input")).toBe("warning");
    expect(botAvatarStatusTone("waiting_takeover")).toBe("warning");
    expect(botAvatarStatusTone("failed")).toBe("destructive");
    expect(botAvatarStatusTone("running")).toBeNull();
    expect(botAvatarStatusTone(undefined)).toBeNull();
  });
});
