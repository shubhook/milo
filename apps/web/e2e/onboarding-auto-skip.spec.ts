import { expect, test } from "@playwright/test";
import { captureScreenshot, reachMeetStep, sayHiToFirstBot, signup } from "./helpers";

test("meet the first bot offers six colors and creates Chief", async ({ page }, testInfo) => {
  const createRequest = page.waitForRequest("**/rpc/bots/create");
  const stamp = Date.now();
  await signup(page, `meet-first-bot-${stamp}@rakazo.test`, "password12", `Meet ${stamp}`);

  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Server integrations" })).toBeHidden();
  await reachMeetStep(page);
  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("Chief");
  await expect(page.getByRole("button", { name: /^Color / })).toHaveCount(6);
  await page.getByRole("button", { name: "Color #10B981" }).click();
  await captureScreenshot(page, testInfo, "onboarding-meet-first-bot");
  await sayHiToFirstBot(page);

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

test("connect your apps lists featured apps with their logos and opens the chat", async ({
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
  await reachMeetStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connect your apps" })).toBeVisible({
    timeout: 20_000,
  });
  const list = page.getByRole("list");
  await expect(list.getByText("Gmail", { exact: true })).toBeVisible();
  await expect(list.locator("img")).toHaveCount(2);
  // An app without a logo shows its first letter.
  await expect(list.getByText("S", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Step 3 of 3" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await expect(list.getByText("Connected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await captureScreenshot(page, testInfo, "onboarding-connect-apps");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
  await expect(page.getByRole("combobox", { name: "Message Chief" })).toBeVisible();
});
