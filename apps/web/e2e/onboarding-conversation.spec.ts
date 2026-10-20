import { expect, test } from "@playwright/test";
import { captureScreenshot, sayHiToFirstBot, signInWithChatGpt } from "./helpers";

test("welcome, ChatGPT sign-in, meet Chief, skip apps, then Chief introduces itself", async ({
  page,
}, testInfo) => {
  const stamp = Date.now();
  await page.goto("/");
  await expect(page.locator('[data-rakazo-surface="welcome"]')).toBeVisible();
  await captureScreenshot(page, testInfo, "00-welcome");
  await page.getByRole("button", { name: /Sign up/ }).click();

  await expect(page.getByRole("img", { name: "Step 1 of 3" })).toBeVisible();
  await expect(page.getByPlaceholder("Your email address")).toHaveCount(0);
  await signInWithChatGpt(page, `onboarding-${stamp}@rakazo.test`, "Robin", testInfo);
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 });
  await expect(page.getByRole("img", { name: "Step 2 of 3" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Color / })).toHaveCount(6);
  await sayHiToFirstBot(page, testInfo);

  const transcript = page.getByTestId("transcript");
  await expect(
    transcript.getByText(
      "Hi, I'm Chief. I run on your own subscription and work on my own computer. What should I take off your plate first?",
    ),
  ).toBeVisible({ timeout: 20_000 });
  const chips = transcript.getByTestId("suggestion-chips");
  for (const chip of ["Plan my week", "Find something for me", "Make another bot"]) {
    await expect(chips.getByRole("button", { name: chip, exact: true })).toBeVisible();
  }
  await page.mouse.move(1, 1);
  await captureScreenshot(page, testInfo, "04-first-chat-intro");

  await chips.getByRole("button", { name: "Find something for me", exact: true }).click();
  await expect(
    transcript.getByTestId("message-user-bubble").filter({ hasText: "Find something for me" }),
  ).toBeVisible();

  // Opening the chat again does not post a second intro.
  await page.reload();
  await expect(transcript.getByTestId("suggestion-chips")).toHaveCount(1);
});
