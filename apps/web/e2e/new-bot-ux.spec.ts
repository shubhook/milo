import { expect, test } from "@playwright/test";
import {
  captureScreenshot,
  completeOnboarding,
  createBotFromPicker,
  openNewBot,
  rpc,
  signup,
} from "./helpers";

test("+ opens the form, then an empty chat; sidebar collapses", async ({ page }, testInfo) => {
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
  await expect(form.locator("label:has-text('Title') input")).toBeVisible();
  await expect(form.locator("label:has-text('What this bot is for') textarea")).toBeVisible();
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
  await expect(form.getByTestId("create-bot-computer")).toBeVisible();
  await expect(form.getByTestId("create-bot-team")).toBeVisible();
  await expect(form.getByTestId("create-bot-private")).toBeVisible();
  await captureScreenshot(page, testInfo, "create-bot-form");

  await form.locator("label:has-text('Name') input").fill("New Bot");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "create-chat-sidepanel-closed");

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
  // The edge slides to the window edge; grab it only once it has settled there.
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

test("later bot waits before showing the focus card; sending cancels it", async ({ page }) => {
  const stamp = Date.now();
  await signup(page, `focus-delay-${stamp}@rakazo.test`, "password12", "Focus Delay");
  await completeOnboarding(page);
  // First bot from onboarding shows the focus card immediately.
  await expect(page.getByText("What do you want me on first?", { exact: true })).toBeVisible();

  await page.clock.install();
  await createBotFromPicker(page);
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);

  await page.clock.fastForward(9_000);
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
  await page.clock.fastForward(1_500);
  await expect(page.getByText("What do you want me on first?", { exact: true })).toBeVisible();

  await createBotFromPicker(page, { name: "Later Bot" });
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
  const composer = page.getByPlaceholder(/Message/);
  await composer.fill("I'll set this up myself");
  // Send must finish before the delay is advanced: cancel runs after a successful
  // RPC, and promptFocus will still post if the clock fires while send is in flight.
  const sent = page.waitForResponse(
    (response) => response.url().includes("/rpc/threads/send") && response.ok(),
  );
  await page.keyboard.press("Enter");
  await sent;
  // Scope to the user bubble: the assistant reply can echo this phrase as a substring.
  await expect(
    page
      .getByTestId("transcript")
      .getByTestId("message-user-bubble")
      .getByText("I'll set this up myself", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(12_000);
  await expect(page.getByText("What do you want me on first?", { exact: true })).toHaveCount(0);
});

test("plus picker can create a Private computer bot", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `new-bot-private-${stamp}@rakazo.test`, "password12", "New Bot Private");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/[^/]+$/);

  await createBotFromPicker(page, { computerMode: "dedicated" });
  await expect(page.getByPlaceholder("Message New Bot")).toBeVisible();
  await captureScreenshot(page, testInfo, "create-private-computer-bot");

  const botId = page.url().split("/").pop()!;
  const bots = await rpc<Array<{ id: string; computerMode: string }>>(page, "bots/list", {});
  expect(bots.find((bot) => bot.id === botId)?.computerMode).toBe("dedicated");
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
  await form.locator("label:has-text('Title') input").fill("Finds sources");
  await form
    .locator("label:has-text('What this bot is for') textarea")
    .fill("Briefs from the web.");
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
