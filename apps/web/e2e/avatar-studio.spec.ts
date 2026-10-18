import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

test("the bot profile opens Avatar Studio on the Bot tab", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `avatar-studio-${stamp}@rakazo.test`, "password12", "Avatar Studio");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await page.getByTestId("bot-settings-trigger").click();
  const settings = page.getByTestId("bot-settings");
  await expect(settings).toBeVisible();

  await page.getByTestId("side-panel").getByTestId("avatar-studio-trigger").click();
  const studio = page.getByTestId("avatar-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByText("Avatar Studio", { exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Bot", exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "Generate" })).toHaveCount(0);
  await expect(studio.getByTestId("avatar-studio-bot-tab")).toBeVisible();
  await expect(studio.getByText("Shape", { exact: true })).toBeVisible();
  await expect(studio.getByText("Color", { exact: true })).toBeVisible();
  for (const shape of ["Circle", "Rounded square", "Dome", "Tile"]) {
    await expect(studio.getByRole("button", { name: shape, exact: true })).toBeVisible();
  }
  await studio.getByRole("button", { name: "Dome", exact: true }).click();
  await expect(studio.getByRole("button", { name: "Dome", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(studio.locator('.rakazo-bot-avatar[data-shape="dome"]').first()).toBeVisible();

  await captureScreenshot(page, testInfo, "avatar-studio-bot-tab");
});
