import { expect, type Page, type TestInfo } from "@playwright/test";

export function activeBotId(page: Page) {
  const id = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  if (!id || id === "app") throw new Error(`missing bot id in ${page.url()}`);
  return id;
}

export async function rpc<T>(page: Page, procedure: string, body: unknown): Promise<T> {
  const response = await page.request.post(`/rpc/${procedure}`, { data: { json: body } });
  const parsed = (await response.json()) as { json?: T; error?: { message?: string } };
  if (!response.ok() || parsed.error) {
    throw new Error(`${procedure} ${response.status()}: ${parsed.error?.message ?? "failed"}`);
  }
  return parsed.json as T;
}

export async function completeOnboarding(page: Page, testInfo?: TestInfo) {
  await page.waitForURL(/\/(onboarding|app)/, { timeout: 20_000 });
  await sayHiToFirstBot(page, testInfo);
  await expect(page.getByText("Chief").first()).toBeVisible();
  if (testInfo) await captureScreenshot(page, testInfo, "06-onboarding-complete");
}

/** Wait for the Meet step, the first step after signing in with ChatGPT. */
export async function reachMeetStep(page: Page) {
  await expect(page.getByRole("heading", { name: "Meet your first bot", exact: true })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
}

/** Meet the first bot, skip the optional apps step, and wait for its chat, when onboarding shows. */
export async function sayHiToFirstBot(page: Page, testInfo?: TestInfo) {
  const meet = page.getByRole("heading", { name: "Meet your first bot", exact: true });
  const apps = page.getByRole("heading", { name: "Connect your apps", exact: true });
  const chat = page.getByRole("combobox", { name: /^Message / });
  await meet.or(chat).first().waitFor({ timeout: 20_000 });
  if (await meet.isVisible().catch(() => false)) {
    if (testInfo) await captureScreenshot(page, testInfo, "03-meet-first-bot");
    await page.getByRole("button", { name: /^(Continue|Say hi)$/ }).click();
    await apps.or(chat).first().waitFor({ timeout: 20_000 });
  }
  if (await apps.isVisible().catch(() => false)) {
    if (testInfo) await captureScreenshot(page, testInfo, "02-connect-apps");
    await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  }
  await page.waitForURL(/\/app\//, { timeout: 20_000 });
}

/**
 * Sign in with the offline ChatGPT emulator as this account. The harness stands
 * in for the person approving the sign-in in ChatGPT's tab.
 */
export async function signInWithChatGpt(
  page: Page,
  email: string,
  name: string,
  testInfo?: TestInfo,
) {
  const api = process.env.API_URL ?? "http://127.0.0.1:3110";
  await page.context().route("https://chatgpt.example.test/**", async (route) => {
    const state = new URL(route.request().url()).searchParams.get("state");
    await page.request.post(`${api}/__e2e/chatgpt/authorize`, { data: { state, email, name } });
    await route.fulfill({ body: "" });
  });
  await expect(page.getByRole("heading", { name: "Sign in with ChatGPT" })).toBeVisible();
  if (testInfo) await captureScreenshot(page, testInfo, "01-sign-up");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

/** Create an account through Sign in with ChatGPT. The password is unused there. */
export async function signup(
  page: Page,
  email: string,
  _password: string,
  name: string,
  testInfo?: TestInfo,
) {
  await page.goto("/sign-up");
  await signInWithChatGpt(page, email, name, testInfo);
}

/** Create an email and password account, for specs about password sign-in. */
export async function signupWithEmail(page: Page, email: string, password: string, name: string) {
  await page.goto("/sign-up?with=email");
  await expect(page.getByRole("heading", { name: "Create your Milo" })).toBeVisible();
  await page.getByPlaceholder("Your name").fill(name);
  await page.getByPlaceholder("Your email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    path: screenshotPath,
  });
  await testInfo.attach(name, { contentType: "image/png", path: screenshotPath });
}

export async function openNewBot(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await expect(page.getByTestId("create-bot-form")).toBeVisible();
}

export async function openNewGroup(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-group").click();
}

export async function openNewSpace(page: Page) {
  await page.getByTestId("create-menu-trigger").click();
  await page.getByTestId("create-new-space").click();
}

/** Open the create form from +, submit, and wait for the new chat. */
export async function createBotFromPicker(
  page: Page,
  options: {
    name?: string;
    title?: string;
    description?: string;
    computerMode?: "team" | "dedicated";
  } = {},
) {
  const name = options.name ?? "New Bot";
  await openNewBot(page);
  const form = page.getByTestId("create-bot-form");
  await form.locator("label:has-text('Name') input").fill(name);
  if (options.title != null) {
    await form.locator("label:has-text('Title') input").fill(options.title);
  }
  if (options.description != null) {
    await form.locator("label:has-text('What this bot is for') textarea").fill(options.description);
  }
  if (options.computerMode === "dedicated") {
    await form.getByTestId("create-bot-private").click();
  } else if (options.computerMode === "team") {
    await form.getByTestId("create-bot-team").click();
  }
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(/\/app\/[^/]+$/);
  await expect(page.getByTestId("side-panel")).toHaveAttribute("data-panel", "closed");
}

/** Open the user Settings overlay, optionally switching to a sidebar section. */
export async function openUserSettings(
  page: Page,
  section?: "general" | "usage" | "approvals" | "notifications" | "memory" | "computer" | "updates",
) {
  await page.getByTestId("sidebar-settings").click();
  const settings = page.getByTestId("user-settings");
  await expect(settings).toBeVisible();
  if (section && section !== "general") {
    await settings.getByTestId(`settings-nav-${section}`).click();
  }
  return settings;
}

/** Create a named bot via RPC for test setup (skips the + picker). */
export async function createNamedBot(
  page: Page,
  name: string,
  options: { computerMode?: "team" | "dedicated" } = {},
) {
  const bot = await rpc<{ id: string; name: string }>(page, "bots/create", {
    name,
    title: "",
    description: "",
    notifyOnFinish: true,
    computerMode: options.computerMode ?? "team",
  });
  await page.goto(`/app/${bot.id}`);
  await expect(page.getByPlaceholder(`Message ${name}`)).toBeVisible();
  return bot.id;
}
