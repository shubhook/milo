import { describe, expect, it } from "vitest";
import { type ColorTokens, darkTokens, lightTokens } from "./index.js";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// Text that has to stay readable (WCAG AA, 4.5:1) on the surfaces it is drawn on.
const TEXT_ON_SURFACE: Array<[keyof ColorTokens, keyof ColorTokens]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "sidebar"],
  ["foreground", "warningSurface"],
  ["foreground", "destructiveSurface"],
  ["mutedForeground", "background"],
  ["mutedForeground", "card"],
  ["mutedForeground", "sidebar"],
  ["warning", "background"],
  ["warning", "card"],
  ["warning", "warningSurface"],
  ["success", "background"],
  ["success", "card"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["primaryForeground", "primary"],
  ["chatUserForeground", "chatUser"],
];

describe.each([
  ["light", lightTokens],
  ["dark", darkTokens],
] as const)("%s palette", (_name, palette: ColorTokens) => {
  it.each(TEXT_ON_SURFACE)("keeps %s readable on %s", (text, surface) => {
    expect(contrast(palette[text], palette[surface])).toBeGreaterThanOrEqual(4.5);
  });
});
