import type { AdapterContext } from "@milo/adapter-kit";
import type { ComputerMode } from "@milo/contracts";
import { describe, expect, it } from "vitest";
import { resolveBotWorkspacePath } from "./computer-support.js";
import { FakeSandboxProvider } from "./fake-sandbox.js";
import { FakeWebProvider } from "./fake-web.js";
import { TOOL_RESULT_TEXT_LIMIT } from "./pi-runtime-limits.js";
import { SHELL_OUTPUT_INLINE_CHARS, spillFinishedShellOutput } from "./shell-command-stream.js";
import { MAX_WEB_FETCH_FILE_CHARS } from "./web-limits.js";
import { webFetchFileName, webFetchFromTool } from "./web-tools.js";
import type { SaveWorkspaceFile } from "./workspace-spill.js";
import { spillFileName } from "./workspace-spill.js";

const ctx: AdapterContext = {
  operationId: "1",
  traceId: "1",
  spaceId: "w",
  userId: "u",
  signal: new AbortController().signal,
};

const pageUrl = "https://docs.example.test/guide/intro";
const longText = "0123456789".repeat(2_000);

/** The executor's save callback, against the fake sandbox. */
async function workspace(mode: ComputerMode) {
  const sandbox = new FakeSandboxProvider();
  const computer = await sandbox.provision({ botId: "bot-1", homePath: "/home" }, ctx);
  const save: SaveWorkspaceFile = (path, content) =>
    sandbox.writeFile(
      computer,
      { path: resolveBotWorkspacePath(mode, "bot-1", path), content },
      ctx,
    );
  const read = async (path: string) =>
    new TextDecoder().decode(
      await sandbox.readFile(computer, resolveBotWorkspacePath(mode, "bot-1", path), ctx),
    );
  return { save, read, files: () => [...sandbox.boxes.get(computer.id)!.files.keys()] };
}

function fakeWeb(text: string) {
  const web = new FakeWebProvider();
  web.fetchResult = { url: pageUrl, title: "Intro", text, truncated: false };
  return web;
}

describe("spill file names", () => {
  it("are readable, stable, and differ by the full source", () => {
    expect(webFetchFileName(pageUrl)).toMatch(/^docs.example.test-guide-intro-[0-9a-f]{8}\.md$/);
    expect(webFetchFileName(pageUrl)).toBe(webFetchFileName(pageUrl));
    expect(webFetchFileName(`${pageUrl}?page=2`)).not.toBe(webFetchFileName(pageUrl));
  });

  it("keep query strings out of the readable part", () => {
    const name = webFetchFileName("https://example.test/file?token=SECRET123");
    expect(name).not.toContain("secret123");
    expect(name).toMatch(/^example.test-file-[0-9a-f]{8}\.md$/);
  });

  it("stay short and fall back when the label has no usable characters", () => {
    expect(spillFileName("x".repeat(200), "k", ".txt").length).toBeLessThanOrEqual(73);
    expect(spillFileName("$$$", "k", ".txt")).toMatch(/^output-[0-9a-f]{8}\.txt$/);
  });
});

describe("web_fetch spill", () => {
  it("returns short pages inline without writing a file", async () => {
    const ws = await workspace("dedicated");
    const result = await webFetchFromTool(fakeWeb("short"), ctx, { url: pageUrl }, ws.save);
    expect(result).toEqual({ url: pageUrl, title: "Intro", text: "short", truncated: false });
    expect(ws.files()).toEqual([]);
  });

  it("asks the provider for the file limit only when it can save", async () => {
    const withSave = fakeWeb(longText);
    await webFetchFromTool(withSave, ctx, { url: pageUrl, maxChars: 500 }, async () => {});
    expect(withSave.lastFetch?.maxChars).toBe(MAX_WEB_FETCH_FILE_CHARS);

    const withoutSave = fakeWeb(longText);
    await webFetchFromTool(withoutSave, ctx, { url: pageUrl, maxChars: 500 });
    expect(withoutSave.lastFetch?.maxChars).toBe(500);
  });

  it("saves a long page under the bot folder on a Team computer", async () => {
    const ws = await workspace("team");
    const result = await webFetchFromTool(
      fakeWeb(longText),
      ctx,
      { url: pageUrl, maxChars: 500 },
      ws.save,
    );
    const path = `web/${webFetchFileName(pageUrl)}`;
    expect(result).toEqual({
      url: pageUrl,
      title: "Intro",
      path,
      totalChars: longText.length,
      truncated: true,
      text: longText.slice(0, 500),
    });
    expect(ws.files()).toEqual([`bots/bot-1/${path}`]);
    await expect(ws.read(path)).resolves.toBe(longText);
  });

  it("saves a long page at the workspace root on a Private computer", async () => {
    const ws = await workspace("dedicated");
    await webFetchFromTool(fakeWeb(longText), ctx, { url: pageUrl, maxChars: 500 }, ws.save);
    expect(ws.files()).toEqual([`web/${webFetchFileName(pageUrl)}`]);
  });

  it("keeps the path inside the clipped tool result even at the largest inline limit", async () => {
    const ws = await workspace("dedicated");
    const result = await webFetchFromTool(
      fakeWeb("a".repeat(60_000)),
      ctx,
      { url: pageUrl, maxChars: 50_000 },
      ws.save,
    );
    const clipped = JSON.stringify(result).slice(0, TOOL_RESULT_TEXT_LIMIT);
    expect(clipped).toContain(`"path":"web/${webFetchFileName(pageUrl)}"`);
    expect(clipped).toContain('"totalChars":60000');
  });

  it("truncates as before without a computer", async () => {
    const result = await webFetchFromTool(fakeWeb(longText), ctx, { url: pageUrl, maxChars: 500 });
    expect(result).toEqual({
      url: pageUrl,
      title: "Intro",
      text: longText.slice(0, 500),
      truncated: true,
    });
  });

  it("truncates when the workspace write fails", async () => {
    const result = await webFetchFromTool(
      fakeWeb(longText),
      ctx,
      { url: pageUrl, maxChars: 500 },
      async () => {
        throw new Error("disk full");
      },
    );
    expect(result).toEqual({
      url: pageUrl,
      title: "Intro",
      text: `${longText.slice(0, 500)}\n\n[Content truncated]`,
      truncated: true,
    });
  });
});

describe("shell output spill", () => {
  it("returns output that fits unchanged", async () => {
    const ws = await workspace("team");
    const result = { stdout: "ok\n", stderr: "", code: 0 };
    await expect(spillFinishedShellOutput(result, "ls", ".", ws.save)).resolves.toBe(result);
    expect(ws.files()).toEqual([]);
  });

  it("saves only the stream that is too long", async () => {
    const ws = await workspace("team");
    const stdout = "x".repeat(SHELL_OUTPUT_INLINE_CHARS + 1);
    const result = await spillFinishedShellOutput(
      { stdout, stderr: "warning", code: 2 },
      "npm test",
      "bots/bot-1",
      ws.save,
    );
    const path = `shell/${spillFileName("npm test", "bots/bot-1\nnpm test", ".stdout.txt")}`;
    expect(path).toMatch(/^shell\/npm-test-[0-9a-f]{8}\.stdout\.txt$/);
    expect(result).toEqual({
      code: 2,
      stdoutPath: path,
      stdoutChars: stdout.length,
      stdout: stdout.slice(0, SHELL_OUTPUT_INLINE_CHARS),
      stderr: "warning",
    });
    expect(Object.keys(result)[1]).toBe("stdoutPath");
    expect(ws.files()).toEqual([`bots/bot-1/${path}`]);
    await expect(ws.read(path)).resolves.toBe(stdout);
  });

  it("returns the output unchanged when the write fails", async () => {
    const result = { stdout: "x".repeat(SHELL_OUTPUT_INLINE_CHARS + 1), stderr: "", code: 0 };
    await expect(
      spillFinishedShellOutput(result, "cat big", ".", async () => {
        throw new Error("disk full");
      }),
    ).resolves.toBe(result);
  });
});
