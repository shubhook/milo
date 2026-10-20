import { ACTIVE_RUN_STATUSES } from "@milo/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvatarStyleProvider } from "./avatar-style.js";
import {
  BotAvatar,
  BotAvatarShapePicker,
  botAvatarBorderRadius,
  DEFAULT_GROK_BOT_COLOR,
  GROK_BOT_COLORS,
  parseBotAvatar,
  resolvePersonaColorDef,
} from "./bot-avatar.js";

describe("BotAvatar", () => {
  it("renders distinct ring gradient IDs for concurrent working avatars", () => {
    const html = renderToString(
      <div>
        <BotAvatar color="#8B5CF6" status="running" />
        <BotAvatar color="#10B981" status="running" />
      </div>,
    );

    const gradMatches = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(gradMatches).toHaveLength(2);
    expect(new Set(gradMatches).size).toBe(2);
    for (const id of gradMatches) expect(html).toContain(`url(#${id})`);
  });

  it.each([...ACTIVE_RUN_STATUSES])("marks active run status %s as working", (status) => {
    const html = renderToString(<BotAvatar color="#3B82F6" status={status} />);
    expect(html).toContain("rakazo-bot-avatar-ring");
    expect(html).toContain('data-working="true"');
  });

  it("keeps working attribute false when idle", () => {
    const html = renderToString(<BotAvatar color="#F59E0B" status="idle" />);
    expect(html).toContain('data-working="false"');
  });

  it("draws a colored shape with two eyes", () => {
    const html = renderToString(
      <BotAvatar color={`${DEFAULT_GROK_BOT_COLOR}::shape_2`} identity="maya" size={32} />,
    );
    expect(html).toContain('data-shape="dome"');
    expect(html).toContain(`border-radius:${botAvatarBorderRadius(2)}`);
    expect(html).not.toContain("<path");
  });

  it("shows a warning dot while waiting, a destructive dot after failing, and an unread dot", () => {
    expect(renderToString(<BotAvatar color="#8B5CF6" status="waiting_input" />)).toContain(
      'data-avatar-dot="warning"',
    );
    expect(renderToString(<BotAvatar color="#8B5CF6" status="failed" />)).toContain(
      'data-avatar-dot="destructive"',
    );
    expect(renderToString(<BotAvatar color="#8B5CF6" unread />)).toContain(
      'data-avatar-dot="unread"',
    );
    expect(renderToString(<BotAvatar color="#8B5CF6" status="completed" />)).not.toContain(
      "data-avatar-dot",
    );
  });

  it("renders distinct shapes for distinct bot identities", () => {
    const maya = renderToString(<BotAvatar color={DEFAULT_GROK_BOT_COLOR} identity="maya" />);
    const github = renderToString(<BotAvatar color={DEFAULT_GROK_BOT_COLOR} identity="github" />);
    expect(maya).not.toEqual(github);
  });

  it("parses shape indexes from encoded color values", () => {
    const parsed = parseBotAvatar(`${DEFAULT_GROK_BOT_COLOR}::shape_3`);
    expect(parsed.color).toBe(DEFAULT_GROK_BOT_COLOR);
    expect(parsed.shapeIndex).toBe(3);
    expect(parsed.isImage).toBe(false);
  });

  it("normalizes malformed shape suffixes to shape 0", () => {
    expect(parseBotAvatar(`${DEFAULT_GROK_BOT_COLOR}::shape_-1`).shapeIndex).toBe(0);
    expect(parseBotAvatar(`${DEFAULT_GROK_BOT_COLOR}::shape_3junk`).shapeIndex).toBe(0);
    expect(parseBotAvatar(`${DEFAULT_GROK_BOT_COLOR}::shape_`).shapeIndex).toBe(0);
  });

  it("exposes the violet identity color as the shared default", () => {
    expect(GROK_BOT_COLORS).toContain(DEFAULT_GROK_BOT_COLOR);
    expect(parseBotAvatar(`${DEFAULT_GROK_BOT_COLOR}::shape_0`).color).toBe(DEFAULT_GROK_BOT_COLOR);
  });

  it("resolves explicit colors and shapes", () => {
    expect(resolvePersonaColorDef("bot", "#10B981").hex.toLowerCase()).toBe("#10b981");
    expect(resolvePersonaColorDef("bot", "#fff").hex).toBe("#fff");
    expect(GROK_BOT_COLORS.length).toBeGreaterThan(0);
  });

  it("falls back to the identity palette for invalid custom hex", () => {
    expect(resolvePersonaColorDef("bot", "#zzzzzz")).toEqual(resolvePersonaColorDef("bot"));
    expect(resolvePersonaColorDef("bot", "#ggg")).toEqual(resolvePersonaColorDef("bot"));
  });

  it("renders uploaded images without the geometric svg", () => {
    const html = renderToString(
      <BotAvatar color="data:image/png;base64,abc" identity="maya" size={32} />,
    );
    expect(html).toContain("<img");
    expect(html).not.toContain(`data-shape="`);
  });

  it("does not treat arbitrary http(s) color values as remote images", () => {
    const parsed = parseBotAvatar("https://evil.example/track.png");
    expect(parsed.isImage).toBe(false);
    expect(parsed.imageUrl).toBeUndefined();
    const html = renderToString(
      <BotAvatar color="https://evil.example/track.png" identity="maya" size={32} />,
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.example");
  });

  it("exposes shape picker name and pressed state", () => {
    const html = renderToString(
      <BotAvatarShapePicker
        shapeIndex={0}
        label="Circle"
        color="#8B5CF6"
        selected
        onClick={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Circle"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("focus-visible:ring-2");
  });

  it("renders distinct robot and organic previews for the same identity", () => {
    const robot = renderToString(
      <BotAvatar color={DEFAULT_GROK_BOT_COLOR} identity="avatar-style-preview" variant="robot" />,
    );
    const organic = renderToString(
      <BotAvatar
        color={DEFAULT_GROK_BOT_COLOR}
        identity="avatar-style-preview"
        variant="organic"
      />,
    );
    expect(robot).not.toEqual(organic);
    expect(robot).toContain(`data-shape="`);
    expect(organic).toContain("rakazo-organic-avatar");
    expect(organic).not.toContain(`data-shape="`);
  });

  it("uses the preferred avatar style when variant is omitted", () => {
    const html = renderToString(
      <AvatarStyleProvider value="organic">
        <BotAvatar color={DEFAULT_GROK_BOT_COLOR} identity="maya" />
      </AvatarStyleProvider>,
    );
    expect(html).toContain("rakazo-organic-avatar");
    expect(html).not.toContain(`data-shape="`);
  });

  it("keeps uploaded images when the organic style is preferred", () => {
    const html = renderToString(
      <BotAvatar color="data:image/png;base64,abc" identity="maya" variant="organic" />,
    );
    expect(html).toContain("<img");
    expect(html).not.toContain("rakazo-organic-avatar");
  });

  it("keeps an encoded studio shape when the organic style is preferred", () => {
    const html = renderToString(
      <BotAvatar color={`${DEFAULT_GROK_BOT_COLOR}::shape_3`} identity="maya" variant="organic" />,
    );
    expect(html).toContain('data-shape="tile"');
    expect(html).not.toContain("rakazo-organic-avatar");
  });

  it("fills the organic body with the resolved palette hex when the custom color is invalid", () => {
    const fallback = resolvePersonaColorDef("maya", "#zzzzzz");
    const html = renderToString(<BotAvatar color="#zzzzzz" identity="maya" variant="organic" />);
    expect(html).toContain("rakazo-organic-avatar");
    expect(html).toContain(`fill="${fallback.hex}"`);
    expect(html).not.toContain("#zzzzzz");
  });
});
