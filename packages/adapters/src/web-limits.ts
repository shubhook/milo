export const DEFAULT_WEB_SEARCH_MAX_RESULTS = 5;
export const MAX_WEB_SEARCH_RESULTS = 10;
export const DEFAULT_WEB_FETCH_MAX_CHARS = 8_000;
export const MAX_WEB_FETCH_MAX_CHARS = 50_000;
export const MIN_WEB_FETCH_MAX_CHARS = 100;
/** Pages longer than the inline limit are saved to the bot's workspace up to this size. */
export const MAX_WEB_FETCH_FILE_CHARS = 1_000_000;

export function clampMaxResults(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WEB_SEARCH_MAX_RESULTS;
  return Math.min(MAX_WEB_SEARCH_RESULTS, Math.max(1, Math.floor(n)));
}

export function clampMaxChars(value: unknown, max: number = MAX_WEB_FETCH_MAX_CHARS): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WEB_FETCH_MAX_CHARS;
  return Math.min(max, Math.max(MIN_WEB_FETCH_MAX_CHARS, Math.floor(n)));
}
