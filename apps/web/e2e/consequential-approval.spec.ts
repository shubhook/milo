import { expect, type Page, test } from "@playwright/test";
import {
  activeBotId,
  captureScreenshot,
  completeOnboarding,
  openUserSettings,
  rpc,
  signup,
} from "./helpers";

test("actions run by default while optional confirmations live in Settings > Approvals", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await signup(page, `action-confirmations-${stamp}@rakazo.test`, "password12", "Approval UI");
  await completeOnboarding(page, testInfo);

  await sendDestinationWrite(page, "write this to the destination crm as a note");
  await waitForRunIdle(page);
  await expectComposerReady(page);
  await expect(page.getByRole("button", { name: "Allow once", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "50-actions-run-without-confirmation");

  await page.getByTestId("bot-settings-trigger").click();
  await expect(page.getByTestId("bot-settings")).toBeVisible();
  await expect(page.getByTestId("bot-settings").getByText("Action confirmations")).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).click();

  const settings = await openUserSettings(page, "approvals");
  await expect(settings).toHaveAttribute("role", "dialog");
  await expect(settings.getByRole("heading", { name: "Approvals", exact: true })).toBeVisible();
  const email = settings.getByRole("group", { name: "Email" });
  await expect(email.getByRole("button", { name: "Act", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(settings.getByTestId("auto-review-toggle")).toBeVisible();
  await expect(settings.getByTestId("auto-review-toggle")).not.toBeChecked();
  await expect(settings.getByText("Flag unexpected actions")).toBeVisible();
  await email.getByRole("button", { name: "Ask first", exact: true }).click();
  await expect(email.getByRole("button", { name: "Ask first", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () =>
      (
        await rpc<{ matchValue: string; effect: string }[]>(page, "approvalRules/list", undefined)
      ).filter((rule) => rule.matchValue === "email" && rule.effect === "require_approval"),
    )
    .toHaveLength(1);
  await captureScreenshot(page, testInfo, "52-settings-approvals");
  await settings.getByRole("button", { name: "Close user settings" }).click();

  await rpc(page, "approvalRules/set", {
    effect: "require_approval",
    matchKind: "connector",
    matchValue: "destination.write",
  });

  await requestDestinationWrite(page, "write this to the destination crm as a note again");
  const allowOnce = page.getByRole("button", { name: "Allow once", exact: true });
  const alwaysAllow = page.getByRole("button", { name: "Always allow", exact: true });
  const deny = page.getByRole("button", { name: "Deny", exact: true });
  await expect(alwaysAllow).toBeVisible();
  await expect(deny).toBeVisible();
  const allowBox = await allowOnce.boundingBox();
  const alwaysBox = await alwaysAllow.boundingBox();
  const denyBox = await deny.boundingBox();
  expect(allowBox).toBeTruthy();
  expect(alwaysBox).toBeTruthy();
  expect(denyBox).toBeTruthy();
  // One row: Allow once, then Always allow, then Deny.
  expect(Math.abs(alwaysBox!.y - allowBox!.y)).toBeLessThan(2);
  expect(Math.abs(denyBox!.y - allowBox!.y)).toBeLessThan(2);
  expect(alwaysBox!.x).toBeGreaterThan(allowBox!.x + allowBox!.width - 2);
  expect(denyBox!.x).toBeGreaterThan(alwaysBox!.x + alwaysBox!.width - 2);
  await expect(page.getByTestId("approval-card").last()).toBeVisible();
  await captureScreenshot(page, testInfo, "53-action-confirmation-pending");

  await page.getByRole("button", { name: "Deny", exact: true }).click();
  await expect(page.getByText("Denied", { exact: true })).toBeVisible();
  await waitForRunIdle(page);
  await expectComposerReady(page);
  await captureScreenshot(page, testInfo, "54-action-confirmation-denied");

  await requestDestinationWrite(page, "write this to the destination crm once more");
  await page.getByRole("button", { name: "Allow once", exact: true }).click();
  await expect(page.getByText("Allowed once", { exact: true })).toBeVisible();
  await waitForRunIdle(page);
  await expectComposerReady(page);
  await captureScreenshot(page, testInfo, "55-action-confirmation-allowed-once");

  await requestDestinationWrite(page, "write this to the destination crm one final time");
  await page.getByRole("button", { name: "Always allow", exact: true }).click();
  await expect(page.getByText("Always allowed", { exact: true })).toBeVisible();
  await waitForRunIdle(page);
  await expectComposerReady(page);
  await captureScreenshot(page, testInfo, "56-action-confirmation-always-allowed");

  await sendDestinationWrite(page, "write this to the destination crm after always allow");
  await waitForRunIdle(page);
  await expectComposerReady(page);
  await expect(page.getByRole("button", { name: "Allow once", exact: true })).toHaveCount(0);
});

async function sendDestinationWrite(page: Page, prompt: string) {
  await expectComposerReady(page);
  const composer = page.getByPlaceholder(/Message/);
  await composer.fill(prompt);
  const sent = page.waitForResponse(
    (response) => response.url().includes("/rpc/threads/send") && response.ok(),
  );
  await page.keyboard.press("Enter");
  await sent;
}

async function expectComposerReady(page: Page) {
  const composer = page.getByPlaceholder(/Message/);
  await expect(composer).toBeVisible();
  await expect(composer).toBeEnabled();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
}

async function requestDestinationWrite(page: Page, prompt: string) {
  await sendDestinationWrite(page, prompt);
  const botId = activeBotId(page);
  await expect
    .poll(
      async () => {
        const snapshot = await rpc<{ run?: { status: string } | null }>(page, "threads/get", {
          botId,
        });
        return snapshot.run?.status ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe("waiting_input");
  // threads/get can observe waiting_input before the shell realtime feed paints the ask card.
  if ((await page.getByRole("button", { name: "Allow once" }).count()) === 0) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder(/Message/)).toBeVisible({ timeout: 15_000 });
  }
  await expect(page.getByRole("button", { name: "Allow once" })).toBeVisible({
    timeout: 15_000,
  });
}

async function waitForRunIdle(page: Page) {
  const botId = activeBotId(page);
  await expect
    .poll(
      async () => {
        const snapshot = await rpc<{ run?: { status: string } | null }>(page, "threads/get", {
          botId,
        });
        return snapshot.run?.status ?? null;
      },
      { timeout: 30_000 },
    )
    .toBeNull();
}
