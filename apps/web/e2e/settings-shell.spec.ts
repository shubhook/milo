import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, signup } from "./helpers";

test("settings shell is Usage, General and Allow list in a browser", async ({ page }, testInfo) => {
  const stamp = Date.now();
  const userName = `Settings shell ${stamp}`;
  await signup(page, `settings-shell-${stamp}@rakazo.test`, "password12", userName);
  await completeOnboarding(page);

  await expect(page.getByTestId("sidebar-settings")).toBeVisible();
  await expect(page.getByTestId("user-menu-trigger")).toHaveCount(0);

  const settings = await openUserSettings(page);
  await expect(settings.getByTestId("settings-nav")).toBeVisible();
  await expect(settings.getByTestId("settings-nav-general")).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const hidden of ["notifications", "memory", "computer", "models"]) {
    await expect(settings.getByTestId(`settings-nav-${hidden}`)).toHaveCount(0);
  }
  // A browser session has no desktop app to update.
  await expect(settings.getByTestId("settings-nav-updates")).toHaveCount(0);
  await expect(settings.getByRole("heading", { name: "General", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  await expect(settings.getByRole("heading", { name: "Password", exact: true })).toHaveCount(0);
  await expect(settings.getByTestId("response-streaming-toggle")).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Server integrations" })).toHaveCount(0);
  await expect(settings.getByTestId("sign-out")).toBeVisible();
  await captureScreenshot(page, testInfo, "settings-shell-general");

  await settings.getByTestId("settings-nav-usage").click();
  await expect(settings).toHaveAttribute("data-settings-section", "usage");
  await expect(settings.getByRole("heading", { name: "Usage", exact: true })).toBeVisible();
  await expect(settings.getByTestId("usage-settings")).toBeVisible();
  // Fresh accounts may have no plan meters yet; the panel still renders a body.
  await expect(
    settings
      .getByTestId("agent-models")
      .or(settings.getByTestId("agent-models-loading"))
      .or(settings.getByRole("alert")),
  ).toBeVisible();
  await expect(settings.getByTestId("model-settings")).toHaveCount(0);
  await expect(settings.getByText("Model spend uses your provider keys.")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-shell-usage");

  await settings.getByTestId("settings-nav-approvals").click();
  await expect(settings.getByRole("heading", { name: "Allow list", exact: true })).toBeVisible();
  await expect(settings.getByTestId("action-confirmation-settings")).toBeVisible();
  await captureScreenshot(page, testInfo, "settings-shell-allow-list");
  await expect(settings.getByTestId("settings-nav-voice")).toHaveCount(0);

  await page.getByRole("button", { name: "Close user settings" }).click();
  await expect(page.getByTestId("user-settings")).toHaveCount(0);

  await openUserSettings(page, "usage");
  await expect(page.getByTestId("user-settings")).toHaveAttribute("data-settings-section", "usage");
  await expect(page.getByTestId("usage-settings")).toBeVisible();
  await expect(
    page
      .getByTestId("agent-models")
      .or(page.getByTestId("agent-models-loading"))
      .or(page.getByRole("alert")),
  ).toBeVisible();
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
            model: "GPT-6 Luna",
            inUse: false,
            limits: [
              {
                windowMinutes: 10_080,
                usedPercent: 92,
                resetsAt: new Date(Date.now() + 120 * hour).toISOString(),
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
  await expect(chatgpt.getByText("GPT-6 Luna")).toBeVisible();
  await expect(chatgpt.getByRole("progressbar", { name: "Weekly" })).toHaveAttribute(
    "data-tone",
    "warning",
  );
  await expect(claude.getByRole("progressbar", { name: "5-hour" })).toHaveAttribute(
    "data-tone",
    "normal",
  );
  await expect(settings.getByTestId("model-settings")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "settings-agent-models");
});
