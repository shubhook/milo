import type { RunStatus } from "@milo/contracts";

/**
 * The four bot avatar shapes. Corner radii are fractions of the avatar size, in CSS order
 * (top-left, top-right, bottom-right, bottom-left), so web and native draw the same shape.
 * Stored `#hex::shape_N` values map to `N % 4`.
 */
export const BOT_AVATAR_SHAPES = [
  { key: "circle", corners: [0.5, 0.5, 0.5, 0.5] },
  { key: "squircle", corners: [0.3, 0.3, 0.3, 0.3] },
  { key: "dome", corners: [0.5, 0.5, 0.42, 0.42] },
  { key: "tile", corners: [0.18, 0.18, 0.18, 0.18] },
] as const;

export type BotAvatarShape = (typeof BOT_AVATAR_SHAPES)[number];

export function botAvatarShape(shapeIndex: number): BotAvatarShape {
  const count = BOT_AVATAR_SHAPES.length;
  const normalized = Number.isFinite(shapeIndex)
    ? ((Math.trunc(shapeIndex) % count) + count) % count
    : 0;
  return BOT_AVATAR_SHAPES[normalized] ?? BOT_AVATAR_SHAPES[0];
}

/** Stable shape for a bot that never picked one. */
export function botAvatarShapeIndexForIdentity(identity: string): number {
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % BOT_AVATAR_SHAPES.length;
}

/** Two pill eyes, sized from the avatar so every size reads as the same face. */
export function botAvatarEyes(size: number) {
  const width = Math.max(2, Math.round(size * 0.125));
  return {
    width,
    height: Math.max(3, Math.round(size * 0.19)),
    gap: Math.max(2, Math.round(size * 0.1)),
    radius: width / 2,
  };
}

/** The avatar's status dot: warning when the bot needs you, destructive when its run failed. */
export function botAvatarStatusTone(
  status: RunStatus | string | undefined,
): "warning" | "destructive" | null {
  if (status === "waiting_input" || status === "waiting_takeover") return "warning";
  if (status === "failed") return "destructive";
  return null;
}
