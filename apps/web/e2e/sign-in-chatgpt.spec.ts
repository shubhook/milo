import { expect, test } from "@playwright/test";
import { captureScreenshot } from "./helpers";

test("signs in only with ChatGPT when the browser shares the server's computer", async ({
  page,
}, testInfo) => {
  await page.route("**/api/auth/capabilities", (route) =>
    route.fulfill({ json: { passwordReset: false, resetUrl: null, chatgpt: "browser" } }),
  );
  await page.route("**/api/auth/chatgpt/start", (route) =>
    route.fulfill({ json: { flowId: "flow-1", url: "https://auth.openai.com/oauth/authorize" } }),
  );
  await page.route("**/api/auth/chatgpt/finish", (route) =>
    route.fulfill({ json: { status: "error", error: "Registration is closed" } }),
  );
  await page.route("https://auth.openai.com/**", (route) => route.fulfill({ body: "" }));

  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in with ChatGPT" })).toBeVisible();
  await expect(page.getByPlaceholder("Your email address")).toHaveCount(0);
  const button = page.getByRole("button", { name: "Continue", exact: true });
  await expect(button).toBeVisible();
  await captureScreenshot(page, testInfo, "sign-in-chatgpt");

  await button.click();
  await expect(page.getByRole("alert")).toHaveText("Registration is closed", { timeout: 10_000 });
  await expect(button).toBeEnabled();
});

test("falls back to email for a server on another computer", async ({ page }) => {
  await page.route("**/api/auth/capabilities", (route) =>
    route.fulfill({ json: { passwordReset: false, resetUrl: null, chatgpt: null } }),
  );
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with ChatGPT" })).toHaveCount(0);
});
