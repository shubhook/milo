import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, signup } from "./helpers";

test("settings shell is two-pane and deep-links Models Memory Voice Usage", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  const userName = `Settings shell ${stamp}`;
  await signup(page, `settings-shell-${stamp}@rakazo.test`, "password12", userName);
  await completeOnboarding(page);

  await page.getByTestId("user-menu-trigger").click();
  const menu = page.locator('[data-slot="popover-content"]');
  await expect(menu.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Usage", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Models", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-account-menu-lean");
  await page.keyboard.press("Escape");

  const settings = await openUserSettings(page);
  await expect(settings.getByTestId("settings-nav")).toBeVisible();
  await expect(settings.getByTestId("settings-nav-general")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(settings.getByRole("heading", { name: "General", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Replies", exact: true })).toHaveCount(0);
  await settings.getByTestId("advanced-settings").locator("summary").click();
  const streamReplies = settings.getByTestId("response-streaming-toggle");
  await expect(streamReplies).toBeVisible();
  await expect(streamReplies).not.toBeChecked();
  await expect(settings.getByText("Stream replies", { exact: true })).toBeVisible();
  await streamReplies.scrollIntoViewIfNeeded();
  await captureScreenshot(page, testInfo, "settings-shell-general");
  await streamReplies.click();
  await expect(streamReplies).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("rakazo.responseStreaming")))
    .toBe("on");

  await settings.getByTestId("settings-nav-usage").click();
  await expect(settings).toHaveAttribute("data-settings-section", "usage");
  await expect(settings.getByTestId("settings-nav-models")).toHaveCount(0);
  await expect(settings.getByTestId("usage-settings")).toBeVisible();
  await expect(settings.getByTestId("model-settings")).toBeVisible();
  await captureScreenshot(page, testInfo, "settings-shell-usage-models");

  await settings.getByTestId("settings-nav-memory").click();
  await expect(settings).toHaveAttribute("data-settings-section", "memory");
  await expect(settings.getByRole("heading", { name: "Memory", exact: true })).toBeVisible();
  const memory = settings.getByTestId("memory-settings");
  await expect(memory.getByTestId("space-memory-documents")).toBeVisible();
  await expect(memory.getByLabel("Provider")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-shell-memory");

  await settings.getByTestId("settings-nav-voice").click();
  await expect(settings).toHaveAttribute("data-settings-section", "voice");
  await expect(settings.getByRole("heading", { name: "Voice", exact: true })).toBeVisible();
  await expect(settings.getByTestId("voice-settings")).toBeVisible();
  await captureScreenshot(page, testInfo, "settings-shell-voice");

  await page.getByRole("button", { name: "Close voice settings" }).click();
  await expect(page.getByTestId("user-settings")).toHaveCount(0);

  await openUserSettings(page, "usage");
  await expect(page.getByTestId("user-settings")).toHaveAttribute("data-settings-section", "usage");
  await expect(page.getByTestId("usage-settings")).toBeVisible();
  await captureScreenshot(page, testInfo, "settings-shell-usage");
});

test("usage lists the agent's models with their plan limits", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await page.route("**/rpc/bootstrap", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.json.me = {
      ...body.json.me,
      modelManaged: true,
      defaultProvider: "claude-code",
      defaultModel: "sonnet",
    };
    await route.fulfill({ response, json: body });
  });
  const hour = 60 * 60 * 1000;
  await page.route("**/rpc/agent/models", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: [
          {
            provider: "claude-code",
            label: "Claude Code",
            model: "sonnet",
            inUse: true,
            limits: [
              {
                windowMinutes: 300,
                usedPercent: 47,
                resetsAt: new Date(Date.now() + 2 * hour).toISOString(),
              },
              {
                windowMinutes: 10_080,
                usedPercent: 6,
                resetsAt: new Date(Date.now() + 96 * hour).toISOString(),
              },
            ],
            limitsUpdatedAt: new Date().toISOString(),
          },
          {
            provider: "chatgpt",
            label: "ChatGPT",
            model: "GPT-6 Sol",
            inUse: false,
            limits: [],
            limitsUpdatedAt: null,
          },
          {
            provider: "codex",
            label: "Codex",
            model: "ChatGPT Plus",
            inUse: false,
            limits: [
              {
                windowMinutes: 43_200,
                usedPercent: 12,
                resetsAt: new Date(Date.now() + 240 * hour).toISOString(),
              },
            ],
            limitsUpdatedAt: new Date().toISOString(),
          },
        ],
      }),
    }),
  );
  await signup(page, `agent-models-${stamp}@rakazo.test`, "password12", `Agent models ${stamp}`);
  await completeOnboarding(page);

  const settings = await openUserSettings(page, "usage");
  const claude = settings.getByTestId("agent-model-claude-code");
  await expect(claude.getByRole("heading", { name: "Claude Code" })).toBeVisible();
  await expect(claude.getByText("In use", { exact: true })).toBeVisible();
  await expect(claude.getByRole("progressbar", { name: "5-hour" })).toBeVisible();
  await expect(claude.getByText("47% used")).toBeVisible();
  await expect(claude.getByRole("progressbar", { name: "Weekly" })).toBeVisible();
  const chatgpt = settings.getByTestId("agent-model-chatgpt");
  await expect(chatgpt.getByText("Limits show after the next run.")).toBeVisible();
  const codex = settings.getByTestId("agent-model-codex");
  await expect(codex.getByRole("progressbar", { name: "30-day" })).toBeVisible();
  await expect(settings.getByTestId("model-settings")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-agent-models");
});
