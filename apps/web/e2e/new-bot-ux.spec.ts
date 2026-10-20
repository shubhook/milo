import { expect, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  createBotFromPicker,
  openNewBot,
  signup,
} from "./helpers";

test("+ opens the form, then an intro chat; sidebar collapses", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `new-bot-ux-${stamp}@rakazo.test`, "password12", "New Bot UX");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await page.getByTestId("create-menu-trigger").click();
  await expect(page.getByTestId("bot-create-picker")).toHaveCount(0);
  const form = page.getByTestId("create-bot-form");
  await expect(form).toBeVisible();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
  await expect(form.locator("label:has-text('Name') input")).toBeVisible();
  await expect(form.locator("label:has-text('What should it do?') textarea")).toBeVisible();
  await expect(form.locator("label:has-text('Title')")).toHaveCount(0);
  await expect(form.getByTestId("create-bot-computer")).toHaveCount(0);
  await expect(form.getByTestId("create-bot-runs-on")).toHaveCount(0);
  for (const starter of ["Inbox", "Research", "Design", "Expenses"]) {
    await expect(form.getByRole("button", { name: starter, exact: true })).toBeVisible();
  }
  await form.getByRole("button", { name: "Research", exact: true }).click();
  await expect(form.locator("label:has-text('Name') input")).toHaveValue("Juno");
  await expect(form.getByRole("button", { name: "Rounded square" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("dialog").locator('.rakazo-bot-avatar[data-shape="squircle"]'),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "create-bot-form");

  await form.locator("label:has-text('Name') input").fill("New Bot");
  await form
    .locator("label:has-text('What should it do?') textarea")
    .fill("Help with research briefs.");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
  // Sidebar preview repeats the intro, so match the transcript bubble only.
  await expect(
    page
      .getByTestId("transcript")
      .getByTestId("message-bot-bubble")
      .getByText(/Hi, I'm New Bot\. I run on your own subscription/),
  ).toBeVisible();
  await expect(page.getByTestId("suggestion-chips")).toBeVisible();
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "create-chat-intro");

  await page.getByTestId("minimize-bots-sidebar").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "true");
  const edge = page.getByTestId("bots-sidebar-edge");
  await expect(edge).toBeVisible();
  const restore = page.getByTestId("restore-bots-sidebar");
  await expect(restore).toBeVisible();
  await captureScreenshot(page, testInfo, "bots-sidebar-collapsed");

  await restore.click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "false");
  await expect(restore).toHaveCount(0);

  await page.getByTestId("minimize-bots-sidebar").click();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "true");
  await expect.poll(async () => (await edge.boundingBox())?.x).toBe(0);

  const box = await edge.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + box!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("bots-sidebar")).toHaveAttribute("data-collapsed", "false");
  await captureScreenshot(page, testInfo, "bots-sidebar-expanded");
});

test("new bot skips the old focus card", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, `focus-gone-${stamp}@rakazo.test`, "password12", "Focus Gone");
  await completeOnboarding(page);

  await createBotFromPicker(page, { description: "Keep my calendar clear." });
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("suggestion-chips")).toBeVisible();
});

test("Runs on appears only when Claude Code is ready", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, `runs-on-${stamp}@rakazo.test`, "password12", "Runs On");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await openNewBot(page);
  await expect(page.getByTestId("create-bot-runs-on")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel new bot" }).click();

  await page.route("**/rpc/agent/status", (route) =>
    route.fulfill({
      json: {
        json: {
          agent: "claude-code",
          installed: true,
          version: "1.0.0",
          loggedIn: true,
          platform: "darwin",
          chatgpt: true,
        },
      },
    }),
  );
  await openNewBot(page);
  const form = page.getByTestId("create-bot-form");
  await expect(form.getByTestId("create-bot-runs-on")).toBeVisible();
  await expect(form.getByTestId("create-bot-chatgpt")).toBeVisible();
  await expect(form.getByTestId("create-bot-claude")).toBeVisible();
});

test("second bot from plus opens create form before persist", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `second-bot-form-${stamp}@rakazo.test`, "password12", "Second Bot Form");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await openNewBot(page);
  const form = page.getByTestId("create-bot-form");
  await expect(form).toBeVisible();
  await form.locator("label:has-text('Name') input").fill("Researcher");
  await form.locator("label:has-text('What should it do?') textarea").fill("Briefs from the web.");
  await captureScreenshot(page, testInfo, "second-bot-create-form");

  const create = page.waitForResponse(
    (response) => response.url().includes("/rpc/bots/create") && response.ok(),
  );
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await create;
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message Researcher")).toBeVisible();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
  await captureScreenshot(page, testInfo, "second-bot-created");
});
