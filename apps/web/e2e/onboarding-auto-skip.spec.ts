import { expect, test } from "@playwright/test";
import { captureScreenshot, reachMeetStep, signup } from "./helpers";

test("onboarding skips agent setup when Claude Code is ready and meets the first bot", async ({
  page,
}, testInfo) => {
  await page.route("**/rpc/agent/status", (route) =>
    route.fulfill({
      json: {
        json: {
          agent: "claude-code",
          chatgpt: false,
          installed: true,
          version: "2.1.0",
          loggedIn: true,
          platform: "linux",
        },
      },
    }),
  );

  await page.route("**/rpc/integrationSetup/get", (route) =>
    route.fulfill({
      json: {
        json: {
          canConfigure: false,
          needsSetup: false,
          webUrl: "https://example.test/integrations/setup",
          providers: [],
        },
      },
    }),
  );

  const createRequest = page.waitForRequest("**/rpc/bots/create");
  const stamp = Date.now();
  await signup(
    page,
    `agent-auto-skip-${stamp}@rakazo.test`,
    "password12",
    `Agent auto skip ${stamp}`,
  );

  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Server integrations" })).toBeHidden();
  for (const name of ["Composio", "Pipedream", "Executor"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeHidden();
  }
  await reachMeetStep(page);
  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("Chief");
  await page.getByRole("button", { name: "Color #10B981" }).click();
  await captureScreenshot(page, testInfo, "onboarding-meet-first-bot");
  await page.getByRole("button", { name: "Say hi", exact: true }).click();

  expect((await createRequest).postDataJSON()).toMatchObject({
    json: {
      name: "Chief",
      title: "",
      description: "",
      instructions: "",
      color: "#10B981::shape_0",
      spawnKey: "onboarding:first",
    },
  });
  await expect(page.getByRole("combobox", { name: "Message Chief" })).toBeVisible({
    timeout: 20_000,
  });
  await captureScreenshot(page, testInfo, "onboarding-auto-skip");
});

test("connect your apps lists featured apps with their logos and can be skipped", async ({
  page,
}, testInfo) => {
  const logo = (fill: string) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="${fill}"/></svg>`,
    )}`;
  const catalog = [
    { slug: "gmail", name: "Gmail", logo: logo("#999999") },
    { slug: "googlecalendar", name: "Google Calendar", logo: logo("#777777") },
    { slug: "slack", name: "Slack", logo: null },
  ].map((item) => ({ ...item, connectorId: "composio", connected: false, noAuth: false }));
  await page.route("**/rpc/connections/catalog", (route) =>
    route.fulfill({ json: { json: catalog } }),
  );
  await page.route("**/rpc/connections/begin", (route) =>
    route.fulfill({
      json: { json: { connectionId: "conn_fake", authorizationUrl: null } },
    }),
  );
  await page.route("**/rpc/connections/complete", (route) =>
    route.fulfill({
      json: {
        json: {
          id: "conn_fake",
          connectorId: "composio",
          provider: "gmail",
          displayName: "Gmail",
          status: "connected",
          capabilities: [],
          createdAt: new Date().toISOString(),
        },
      },
    }),
  );

  const stamp = Date.now();
  await signup(page, `onboarding-apps-${stamp}@rakazo.test`, "password12", `Apps ${stamp}`);
  await expect(page.getByRole("heading", { name: "Connect your apps" })).toBeVisible({
    timeout: 20_000,
  });
  const list = page.getByRole("list");
  await expect(list.getByText("Gmail", { exact: true })).toBeVisible();
  await expect(list.locator("img")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await expect(list.getByText("Connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await captureScreenshot(page, testInfo, "onboarding-connect-apps");

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByRole("heading", { name: "Meet your first bot" })).toBeVisible();
});
