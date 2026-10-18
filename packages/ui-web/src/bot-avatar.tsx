import type { GrokColorDef } from "@milo/core";
import {
  ACTIVE_RUN_STATUSES,
  avatarIdentitySeed,
  BOT_AVATAR_SHAPES,
  botAvatarEyes,
  botAvatarShape,
  botAvatarShapeIndexForIdentity,
  botAvatarStatusTone,
  DEFAULT_GROK_BOT_COLOR,
  GROK_BOT_COLORS,
  GROK_COLOR_LIST,
  organicAvatarPath,
  resolvePersonaColorDef,
} from "@milo/core";
import { tokens } from "@milo/ui-tokens";
import type { CSSProperties } from "react";
import { memo, useId, useMemo, useSyncExternalStore } from "react";
import type { AvatarStyle } from "./avatar-style.js";
import { useAvatarStyle } from "./avatar-style.js";
import { cn } from "./lib/utils.js";
import "./styles.css";

export type { GrokColorDef };
export { DEFAULT_GROK_BOT_COLOR, GROK_BOT_COLORS, GROK_COLOR_LIST, resolvePersonaColorDef };

export function parseBotAvatar(
  rawColor: string,
  _identity?: string,
): {
  color: string;
  shapeIndex?: number;
  isImage: boolean;
  imageUrl?: string;
} {
  if (!rawColor) return { color: "#F97316", isImage: false };
  // Only data: image URLs are rendered. Arbitrary http(s)/blob values in `color`
  // must not become <img src> (SSRF / tracking when other members view the bot).
  if (rawColor.startsWith("data:image/")) {
    return { color: "#F97316", isImage: true, imageUrl: rawColor };
  }
  if (rawColor.includes("::shape_")) {
    const parts = rawColor.split("::shape_");
    const rawShapeIdx = parts[1] ?? "0";
    const parsedShapeIdx = /^\d+$/.test(rawShapeIdx) ? Number(rawShapeIdx) : 0;
    const shapeIdx = Number.isSafeInteger(parsedShapeIdx) ? parsedShapeIdx : 0;
    return {
      color: parts[0] || "#F97316",
      shapeIndex: shapeIdx % BOT_AVATAR_SHAPES.length,
      isImage: false,
    };
  }
  return { color: rawColor, isImage: false };
}

/** CSS `border-radius` for a shape: corner fractions become percentages. */
export function botAvatarBorderRadius(shapeIndex: number): string {
  return botAvatarShape(shapeIndex)
    .corners.map((corner) => `${corner * 100}%`)
    .join(" ");
}

export interface BotAvatarProps {
  color: string;
  size?: number;
  status?: string;
  /** Adds a dot when nothing more urgent (needs you, failed) is showing. */
  unread?: boolean;
  identity?: string;
  className?: string;
  variant?: AvatarStyle;
}

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 36,
  status,
  unread = false,
  identity = "",
  className,
  variant,
}: BotAvatarProps) {
  const id = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const isWorking = ACTIVE_RUN_STATUSES.some((s) => s === status);
  const preferredVariant = useAvatarStyle();

  const parsed = useMemo(() => parseBotAvatar(color, identity), [color, identity]);
  const effectiveId = identity || parsed.color || "agent";

  const colorDef = useMemo(
    () => resolvePersonaColorDef(effectiveId, parsed.color),
    [effectiveId, parsed.color],
  );

  const tone = botAvatarStatusTone(status);
  const dot =
    tone || unread ? (
      <span
        aria-hidden="true"
        data-avatar-dot={tone ?? "unread"}
        className={cn(
          "milo-avatar-dot absolute -end-0.5 -bottom-0.5 rounded-full",
          tone === "warning"
            ? "bg-warning"
            : tone === "destructive"
              ? "bg-destructive"
              : "bg-foreground",
        )}
        style={{
          width: Math.max(8, Math.round(size * 0.3)),
          height: Math.max(8, Math.round(size * 0.3)),
        }}
      />
    ) : null;

  const ring = isWorking ? (
    <svg
      className="rakazo-bot-avatar-ring pointer-events-none absolute"
      style={{ inset: -3, width: size + 6, height: size + 6 }}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke={`url(#${id}-ring)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="45 80"
      />
      <defs>
        <linearGradient id={`${id}-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colorDef.light} stopOpacity="1" />
          <stop offset="100%" stopColor={colorDef.light} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ) : null;

  if (parsed.isImage && parsed.imageUrl) {
    return (
      <span
        className={cn(
          "rakazo-bot-avatar relative inline-flex shrink-0 select-none items-center justify-center",
          className,
        )}
        data-working={isWorking}
        style={{ width: size, height: size }}
      >
        {ring}
        <img
          src={parsed.imageUrl}
          alt=""
          className="h-full w-full rounded-full border border-border bg-secondary object-cover"
        />
        {dot}
      </span>
    );
  }

  if (parsed.shapeIndex === undefined && (variant ?? preferredVariant) === "organic") {
    return (
      <span
        className={cn("relative inline-flex shrink-0", className)}
        style={{ width: size, height: size }}
      >
        <OrganicAvatar
          color={colorDef.hex}
          identity={effectiveId}
          size={size}
          isWorking={isWorking}
        />
        {dot}
      </span>
    );
  }

  const shapeIndex = parsed.shapeIndex ?? botAvatarShapeIndexForIdentity(effectiveId);
  const eyes = botAvatarEyes(size);
  return (
    <span
      className={cn(
        "rakazo-bot-avatar relative inline-flex shrink-0 select-none items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      data-working={isWorking}
      data-shape={botAvatarShape(shapeIndex).key}
    >
      {ring}
      <span
        className="milo-avatar-face flex h-full w-full items-center justify-center"
        style={{
          borderRadius: botAvatarBorderRadius(shapeIndex),
          background: colorDef.hex,
          gap: eyes.gap,
        }}
      >
        {[0, 1].map((eye) => (
          <span
            key={eye}
            style={{
              width: eyes.width,
              height: eyes.height,
              borderRadius: eyes.radius,
              background: colorDef.eyeColor,
            }}
          />
        ))}
      </span>
      {dot}
    </span>
  );
});

function OrganicAvatar({
  color,
  identity,
  size,
  isWorking,
  className,
}: {
  color: string;
  identity?: string;
  size: number;
  isWorking: boolean;
  className?: string;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const seed = avatarIdentitySeed(identity || color || DEFAULT_GROK_BOT_COLOR);
  const duration = `${4.8 + (seed % 24) / 10}s`;
  const shapeA = organicAvatarPath(seed);
  const shapeB = organicAvatarPath(seed, 0.18);

  return (
    <svg
      viewBox="-60 -60 120 120"
      aria-hidden="true"
      className={cn("rakazo-organic-avatar block overflow-hidden select-none", className)}
      data-working={isWorking}
      data-shape-family={seed % 10}
      data-eye-pattern={seed % 4}
      style={{
        width: size,
        height: size,
        flex: "none",
      }}
    >
      {(["idle", "working"] as const).map((mode) => (
        <path
          key={mode}
          className={`rakazo-organic-avatar-body rakazo-organic-avatar-body-${mode}`}
          d={shapeA}
          fill={color}
          style={
            {
              "--rakazo-organic-path": `path("${shapeA}")`,
              filter:
                mode === "working"
                  ? `drop-shadow(0 0 ${Math.round(size * 0.16)}px ${color})`
                  : "drop-shadow(0 1px 2px rgba(0,0,0,.22))",
            } as CSSProperties
          }
        >
          {!reducedMotion ? (
            <animate
              attributeName="d"
              values={`${shapeA};${shapeB};${shapeA}`}
              dur={duration}
              repeatCount="indefinite"
            />
          ) : null}
        </path>
      ))}
      <g transform={`rotate(${(seed % 9) - 4})`}>
        {(["idle", "working"] as const).map((mode) => (
          <g
            key={mode}
            className={`rakazo-organic-avatar-eyes rakazo-organic-avatar-eyes-${mode}`}
            fill={tokens.background}
          >
            <rect x="-14" y="-12" width="7" height="24" rx="3.5" />
            <rect x="7" y="-12" width="7" height="24" rx="3.5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

const reducedMotionMedia = "(prefers-reduced-motion: reduce)";

function reducedMotionSnapshot(): boolean {
  return window.matchMedia(reducedMotionMedia).matches;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia(reducedMotionMedia);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function BotAvatarShapePicker({
  shapeIndex,
  label,
  color,
  selected,
  onClick,
}: {
  shapeIndex: number;
  label: string;
  color: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const colorDef = resolvePersonaColorDef("preview", color);
  const eyes = botAvatarEyes(28);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected ?? false}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg border bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center"
        style={{
          borderRadius: botAvatarBorderRadius(shapeIndex),
          background: colorDef.hex,
          gap: eyes.gap,
        }}
      >
        {[0, 1].map((eye) => (
          <span
            key={eye}
            style={{
              width: eyes.width,
              height: eyes.height,
              borderRadius: eyes.radius,
              background: colorDef.eyeColor,
            }}
          />
        ))}
      </span>
    </button>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center gap-1.5 rounded-full bg-card">
        <span className="h-4 w-[7px] rounded-full bg-primary" />
        <span className="h-4 w-[7px] rounded-full bg-primary" />
      </div>
      <span className="font-[Aeonik,ui-sans-serif] text-[28px] tracking-tight text-foreground">
        Milo
      </span>
    </div>
  );
}
