import type { AdapterContext, WebFetchProvider, WebSearchProvider } from "@milo/adapter-kit";
import { clampMaxChars, clampMaxResults, MAX_WEB_FETCH_FILE_CHARS } from "./web-limits.js";
import type { SaveWorkspaceFile } from "./workspace-spill.js";
import { saveSpillFile, spillFileName } from "./workspace-spill.js";

export async function webSearchFromTool(
  search: WebSearchProvider,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  const query = String(args.query ?? "").trim();
  if (!query) return { error: "query is required" };
  try {
    const results = await search.search(
      {
        query,
        maxResults: clampMaxResults(args.maxResults),
        signal: context.signal,
      },
      context,
    );
    return { results };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch a page for the model. With a workspace, a page longer than the inline
 * limit is saved whole under web/ and the result carries the path and length.
 */
export async function webFetchFromTool(
  fetchProvider: WebFetchProvider,
  context: AdapterContext,
  args: Record<string, unknown>,
  save?: SaveWorkspaceFile,
) {
  const url = String(args.url ?? "").trim();
  if (!url) return { error: "url is required" };
  const maxChars = clampMaxChars(args.maxChars);
  try {
    const result = await fetchProvider.fetch(
      {
        url,
        maxChars: save ? MAX_WEB_FETCH_FILE_CHARS : maxChars,
        signal: context.signal,
      },
      context,
    );
    if (result.text.length <= maxChars) return result;
    const path = `web/${webFetchFileName(result.url)}`;
    if (save && (await saveSpillFile(save, path, result.text))) {
      // Path first: the runtime clips long tool results from the end.
      return {
        url: result.url,
        title: result.title,
        path,
        totalChars: result.text.length,
        truncated: true,
        text: result.text.slice(0, maxChars),
      };
    }
    return {
      ...result,
      text: `${result.text.slice(0, maxChars)}\n\n[Content truncated]`,
      truncated: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Host and path only: query strings can carry signed tokens and stay in the hash. */
export function webFetchFileName(url: string): string {
  let label = url;
  try {
    const parsed = new URL(url);
    label = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // Not a URL; the slug and hash still give a stable name.
  }
  return spillFileName(label, url, ".md");
}
