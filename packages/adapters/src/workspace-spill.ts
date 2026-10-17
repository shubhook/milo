import { createHash } from "node:crypto";

/** Writes a file at a bot-relative workspace path. The caller resolves Team vs Private roots. */
export type SaveWorkspaceFile = (path: string, content: Uint8Array) => Promise<void>;

/**
 * Readable, stable file name: a slug of `label` plus a short hash of `key`, so the
 * same source lands on the same file and different sources never collide.
 */
export function spillFileName(label: string, key: string, extension: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 60)
      .replace(/[-.]+$/, "") || "output";
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return `${slug}-${hash}${extension}`;
}

/** Saves `text` and returns true, or returns false when the workspace write fails. */
export async function saveSpillFile(
  save: SaveWorkspaceFile,
  path: string,
  text: string,
): Promise<boolean> {
  try {
    await save(path, new TextEncoder().encode(text));
    return true;
  } catch {
    return false;
  }
}
