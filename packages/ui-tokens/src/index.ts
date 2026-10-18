export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];

export type ResolvedAppearance = "light" | "dark";

export const UI_APPEARANCE_STORAGE_KEY = "rakazo.uiAppearance";

/**
 * Semantic palette shared by web, Electron, and Expo. Names follow the shadcn
 * convention so the same slot means the same thing on every surface: a `border`
 * is always a border and never a fill.
 */
export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  chatUser: string;
  chatUserForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  link: string;
  success: string;
  warning: string;
  /** Approval card header: something is waiting on the user. */
  warningSurface: string;
  /** Failed-run notice. Keep body text in `foreground`; `destructive` there is for icons and titles. */
  destructiveSurface: string;
  overlay: string;
  scrollbar: string;
  scrollbarHover: string;
};

export const darkTokens = {
  background: "#0B0C0E",
  foreground: "#ECECEE",
  card: "#181A20",
  cardForeground: "#ECECEE",
  popover: "#1C1E26",
  popoverForeground: "#ECECEE",
  primary: "#F1F1EF",
  primaryForeground: "#0B0C0E",
  secondary: "#22242C",
  secondaryForeground: "#ECECEE",
  chatUser: "#2E313A",
  chatUserForeground: "#ECECEE",
  muted: "#24262E",
  mutedForeground: "#A0A0A6",
  accent: "#2C2F38",
  accentForeground: "#ECECEE",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "#3A3D48",
  input: "#22242C",
  ring: "#A1A1A6",
  sidebar: "#121318",
  sidebarForeground: "#ECECEE",
  sidebarBorder: "#2A2C34",
  sidebarAccent: "#24262E",
  sidebarAccentForeground: "#ECECEE",
  link: "#9DB7FF",
  success: "#4ECB71",
  warning: "#E9C46A",
  warningSurface: "#2A2416",
  destructiveSurface: "#2A1618",
  overlay: "rgba(4, 4, 5, 0.72)",
  scrollbar: "#3A3D48",
  scrollbarHover: "#4A4E5A",
} as const satisfies ColorTokens;

export const lightTokens = {
  background: "#FAFAF8",
  foreground: "#1A1A1A",
  card: "#FFFFFF",
  cardForeground: "#1A1A1A",
  popover: "#FFFFFF",
  popoverForeground: "#1A1A1A",
  primary: "#1A1A1A",
  primaryForeground: "#F1F1EF",
  secondary: "#F0F0ED",
  secondaryForeground: "#1A1A1A",
  chatUser: "#E2E2DC",
  chatUserForeground: "#1A1A1A",
  muted: "#F0F0ED",
  mutedForeground: "#5F5F64",
  accent: "#EAEAE6",
  accentForeground: "#1A1A1A",
  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
  border: "#E3E3DE",
  input: "#EAEAE6",
  ring: "#6C6C70",
  sidebar: "#ECECE9",
  sidebarForeground: "#1A1A1A",
  sidebarBorder: "#E8E8E4",
  sidebarAccent: "#FFFFFF",
  sidebarAccentForeground: "#1A1A1A",
  link: "#2563EB",
  success: "#1F7A35",
  warning: "#8A5A0E",
  warningSurface: "#FBF3E2",
  destructiveSurface: "#FCEDED",
  overlay: "rgba(20, 20, 22, 0.45)",
  scrollbar: "#C8C8C4",
  scrollbarHover: "#A8A8A4",
} as const satisfies ColorTokens;

/** Dark palette. Prefer `tokensForAppearance` when theme-aware. */
export const tokens = darkTokens;

export const RADIUS = "0.75rem";

/** One soft shadow for raised cards and the selected sidebar row, and a deeper lift for dialogs. */
export type ElevationTokens = { raised: string; lift: string };

export const darkElevation = {
  raised: "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.35)",
  lift: "0 24px 64px rgba(0, 0, 0, 0.6)",
} as const satisfies ElevationTokens;

export const lightElevation = {
  raised: "0 1px 2px rgba(20, 20, 22, 0.06), 0 8px 24px rgba(20, 20, 22, 0.06)",
  lift: "0 24px 64px rgba(20, 20, 22, 0.18)",
} as const satisfies ElevationTokens;

/**
 * Type scale in px. Geist for UI text, Geist Mono for raw tool detail. Phone body text is
 * one step larger, and phone inputs use 16px so iOS does not zoom into them.
 */
export const typography = {
  fontSans: "Geist Variable",
  fontMono: "Geist Mono Variable",
  body: 14,
  bodyPhone: 15,
  inputPhone: 16,
  small: 13,
  section: 20,
  title: 32,
  titlePhone: 34,
  headingWeight: 600,
} as const;

export const botColors = [
  "#3EC5A8",
  "#F5A03C",
  "#6A6BF5",
  "#9B5CF6",
  "#3B82F6",
  "#F2622A",
  "#D9508A",
] as const;

export function isAppearancePreference(
  value: string | null | undefined,
): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function normalizeAppearancePreference(
  raw: string | null | undefined,
): AppearancePreference {
  return isAppearancePreference(raw) ? raw : "system";
}

export type ResolveAppearancePreferenceOptions = {
  stored?: string | null;
  storage?: Pick<Storage, "getItem"> | null;
};

function getLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function resolveAppearancePreference(
  options: ResolveAppearancePreferenceOptions = {},
): AppearancePreference {
  const stored =
    options.stored !== undefined
      ? options.stored
      : readStoredAppearance(options.storage ?? getLocalStorage());
  return normalizeAppearancePreference(stored);
}

export function persistAppearancePreference(
  preference: AppearancePreference,
  storage: Pick<Storage, "setItem"> | null = getLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(UI_APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // Ignore quota / private-mode failures; in-memory preference still applies.
  }
}

export function resolveAppearance(
  preference: AppearancePreference,
  system: ResolvedAppearance = "dark",
): ResolvedAppearance {
  if (preference === "system") return system;
  return preference;
}

export function tokensForAppearance(appearance: ResolvedAppearance): ColorTokens {
  return appearance === "light" ? lightTokens : darkTokens;
}

function readStoredAppearance(storage: Pick<Storage, "getItem"> | null | undefined): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(UI_APPEARANCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** `cardForeground` -> `--card-foreground` */
export function cssVariableName(token: keyof ColorTokens): string {
  return `--${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function renderBlock(
  selector: string,
  colorScheme: ResolvedAppearance,
  palette: ColorTokens,
  elevation: ElevationTokens,
) {
  const lines = (Object.keys(palette) as (keyof ColorTokens)[]).map(
    (token) => `  ${cssVariableName(token)}: ${palette[token].toLowerCase()};`,
  );
  return `${selector} {\n  color-scheme: ${colorScheme};\n${lines.join("\n")}\n  --elevation-raised: ${elevation.raised};\n  --elevation-lift: ${elevation.lift};\n  --radius: ${RADIUS};\n}`;
}

const fallbackSans = "ui-sans-serif, system-ui, sans-serif";
const fallbackMono = "ui-monospace, SFMono-Regular, Menlo, monospace";

function renderTypography() {
  return [
    ":root {",
    `  --font-family-sans: "${typography.fontSans}", ${fallbackSans};`,
    `  --font-family-mono: "${typography.fontMono}", ${fallbackMono};`,
    `  --font-size-small: ${typography.small}px;`,
    `  --font-size-body: ${typography.body}px;`,
    `  --font-size-section: ${typography.section}px;`,
    `  --font-size-title: ${typography.title}px;`,
    `  --font-weight-heading: ${typography.headingWeight};`,
    "}",
  ].join("\n");
}

/** The CSS in `tokens.css`. Generated from the TS palette so both stay in sync. */
export function renderTokensCss(): string {
  return `${[
    "/* Generated by `pnpm --filter @milo/ui-tokens generate`. Edit src/index.ts instead. */",
    renderTypography(),
    renderBlock(':root,\n[data-theme="dark"]', "dark", darkTokens, darkElevation),
    renderBlock('[data-theme="light"]', "light", lightTokens, lightElevation),
  ].join("\n\n")}\n`;
}
