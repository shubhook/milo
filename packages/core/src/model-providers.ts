import type { AgentModel, ModelCatalogEntry, ModelUsageWindow } from "@milo/contracts";
import { matchesSearchQuery } from "./search.js";

/** Effort choices an OpenAI-compatible endpoint stores when reasoning is enabled. */
export const COMPATIBLE_THINKING_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

const THINKING_LEVELS = ["off", ...COMPATIBLE_THINKING_LEVELS] as const;

/**
 * Map a staged effort onto the levels a model actually supports.
 * An exact match is kept. Otherwise the nearest supported effort is used
 * (higher first, then lower). Models that cannot think, and the "off" level,
 * reset to null so the runtime default applies.
 * `supported === undefined` means the model is outside the catalog: a concrete
 * level is kept because there is no allowance list to clamp against.
 */
export function clampCatalogThinkingLevel(
  level: string | null | undefined,
  supported: readonly string[] | undefined,
): string | null {
  if (!level || level === "off") return null;
  if (supported === undefined) return level;
  const available = supported.filter((entry) => entry !== "off");
  if (available.length === 0) return null;
  if (available.includes(level)) return level;
  const requestedIndex = THINKING_LEVELS.indexOf(level as (typeof THINKING_LEVELS)[number]);
  if (requestedIndex === -1) return null;
  for (let index = requestedIndex; index < THINKING_LEVELS.length; index++) {
    const candidate = THINKING_LEVELS[index];
    if (candidate && candidate !== "off" && available.includes(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index--) {
    const candidate = THINKING_LEVELS[index];
    if (candidate && candidate !== "off" && available.includes(candidate)) return candidate;
  }
  return null;
}

export const POPULAR_MODEL_PROVIDER_IDS = [
  "openrouter",
  "openai-codex",
  "anthropic",
  "openai",
  "google",
  "vercel-ai-gateway",
] as const;

const DEFAULT_PROVIDER_COUNT = POPULAR_MODEL_PROVIDER_IDS.length;
const POPULAR_MODEL_PROVIDER_ID_SET = new Set<string>(POPULAR_MODEL_PROVIDER_IDS);

/** Keep provider selection short while ensuring a deployment's current default is never hidden. */
export function featuredModelProviders(
  providers: readonly ModelCatalogEntry[],
  selectedProvider: string,
): ModelCatalogEntry[] {
  const byId = new Map(providers.map((entry) => [entry.provider, entry]));
  const ordered = [
    ...POPULAR_MODEL_PROVIDER_IDS.map((id) => byId.get(id)).filter(
      (entry): entry is ModelCatalogEntry => entry !== undefined,
    ),
    ...providers.filter((entry) => !POPULAR_MODEL_PROVIDER_ID_SET.has(entry.provider)),
  ];
  const featured = ordered.slice(0, DEFAULT_PROVIDER_COUNT);
  const selected = byId.get(selectedProvider);

  if (!selected || featured.some((entry) => entry.provider === selectedProvider)) return featured;
  return [...featured.slice(0, DEFAULT_PROVIDER_COUNT - 1), selected];
}

/**
 * Model to preselect when a provider row is opened: the preferred id (usually the
 * space or deployment default) when that provider carries it, otherwise the
 * provider's first catalog entry.
 *
 * Aggregator providers prefix ids with the upstream vendor ("openai/gpt-6-luna"
 * on OpenRouter) while first-party providers expose the same model unprefixed
 * ("gpt-6-luna" on OpenAI Codex), so the preferred id's basename is tried after
 * the exact id. This is only a preselection — the user still confirms the pick.
 */
export function pickCatalogModelId(
  catalog: readonly { provider: string; id: string }[],
  provider: string,
  preferredId?: string | null,
): string {
  const entries = catalog.filter((entry) => entry.provider === provider);
  if (preferredId) {
    if (entries.some((entry) => entry.id === preferredId)) return preferredId;
    const basename = preferredId.split("/").at(-1);
    if (basename && basename !== preferredId) {
      const shared = entries.find((entry) => entry.id === basename);
      if (shared) return shared.id;
    }
  }
  return entries[0]?.id ?? "";
}

/** Return the active choice separately when it is not one of the search results. */
export function selectedProviderOutsideSearchResults(
  filteredProviders: readonly ModelCatalogEntry[],
  allProviders: readonly ModelCatalogEntry[],
  selectedProvider: string,
): ModelCatalogEntry | undefined {
  if (filteredProviders.some((entry) => entry.provider === selectedProvider)) {
    return undefined;
  }
  return allProviders.find((entry) => entry.provider === selectedProvider);
}

/** Match a model by name, id, or provider name; a blank query keeps every model. */
export function filterModelCatalog(
  entries: readonly ModelCatalogEntry[],
  query: string,
): readonly ModelCatalogEntry[] {
  if (!query.trim()) return entries;
  return entries.filter((entry) =>
    matchesSearchQuery(query, entry.label, entry.id, entry.providerName ?? entry.provider),
  );
}

/** A window whose reset time has passed has started over, so it reads as unused. */
export function currentUsageWindow(
  window: ModelUsageWindow,
  now: number = Date.now(),
): ModelUsageWindow {
  if (!window.resetsAt || Date.parse(window.resetsAt) > now) return window;
  return { ...window, usedPercent: 0, resetsAt: null };
}

/** At this share of a plan window the meter warns that the limit is close. */
export const USAGE_WINDOW_HIGH_PERCENT = 80;

/** A full window is out until it resets; a nearly full one warns. */
export function usageWindowTone(usedPercent: number): "normal" | "warning" | "destructive" {
  if (usedPercent >= 100) return "destructive";
  if (usedPercent >= USAGE_WINDOW_HIGH_PERCENT) return "warning";
  return "normal";
}

/**
 * The full plan window that blocks the model bots run on now. With several full windows,
 * the one that resets last decides when the plan works again.
 */
export function exhaustedUsageWindow(
  models: readonly AgentModel[],
  now: number = Date.now(),
): { model: AgentModel; window: ModelUsageWindow } | null {
  const model = models.find((item) => item.inUse);
  if (!model) return null;
  const full = model.limits
    .map((window) => currentUsageWindow(window, now))
    .filter((window) => usageWindowTone(window.usedPercent) === "destructive");
  if (full.length === 0) return null;
  const resetTime = (window: ModelUsageWindow) =>
    window.resetsAt ? Date.parse(window.resetsAt) : Number.POSITIVE_INFINITY;
  const window = full.reduce((latest, next) =>
    resetTime(next) > resetTime(latest) ? next : latest,
  );
  return { model, window };
}
