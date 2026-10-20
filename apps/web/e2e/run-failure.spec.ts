import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("a failed run stays in the thread as a card", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `run-failure-${stamp}@rakazo.test`, "password12", "Run Failure");
  await completeOnboarding(page);

  // "fail this run" makes the scripted runtime throw, so the run fails the same way a
  // real provider error would, without depending on how models are configured.
  await page.getByPlaceholder(/^Message /).fill("fail this run");
  await page.getByRole("button", { name: "Send" }).click();

  const transcript = page.getByTestId("transcript");
  const card = transcript.getByTestId("run-failed-card");
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await expect(card).toContainText("Scripted run failure");
  await expect(card.getByRole("button", { name: "Sign in again" })).toHaveCount(0);
  await expect(page.getByTestId("composer-error")).toHaveCount(0);
  await captureScreenshot(page, testInfo, "run-failed-card");

  await page.reload();
  await expect(page.getByTestId("shell-root")).toHaveAttribute("data-ready", "true");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Scripted run failure");

  await page.getByPlaceholder(/^Message /).fill("fail this run");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(card).toHaveCount(2, { timeout: 30_000 });
});

test("a signed-out agent failure offers Sign in again", async ({ page }, testInfo) => {
  await signup(page, `run-signed-out-${Date.now()}@rakazo.test`, "password12", "Signed Out");
  await completeOnboarding(page);
  // Mocked after onboarding, which would otherwise stop on its agent step.
  await page.route("**/rpc/agent/status", (route) =>
    route.fulfill({
      json: {
        json: {
          agent: "claude-code",
          installed: true,
          version: "2.0.0",
          loggedIn: false,
          platform: "linux",
          chatgpt: false,
        },
      },
    }),
  );

  await page.getByPlaceholder(/^Message /).fill("fail signed out");
  await page.getByRole("button", { name: "Send" }).click();
  const card = page.getByTestId("transcript").getByTestId("run-failed-card");
  await expect(card).toContainText("Claude Code is not signed in", { timeout: 30_000 });
  const signIn = card.getByRole("button", { name: "Sign in again" });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page.getByTestId("onboarding-agent-claude")).toBeVisible();
  await captureScreenshot(page, testInfo, "run-failed-sign-in-again");
});
