import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

const hour = 60 * 60 * 1000;

test("a used-up plan window shows a notice above the composer with Use ChatGPT", async ({
  page,
}, testInfo) => {
  let usedPercent = 100;
  await page.route("**/rpc/agent/models", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        json: [
          {
            provider: "claude-code",
            label: "Claude Code",
            model: "sonnet",
            inUse: true,
            limits: [
              {
                windowMinutes: 300,
                usedPercent,
                resetsAt: new Date(Date.now() + 2 * hour).toISOString(),
              },
            ],
            limitsUpdatedAt: new Date().toISOString(),
          },
        ],
      }),
    }),
  );
  await page.route("**/api/auth/capabilities", async (route) => {
    const response = await route.fetch();
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...body, chatgpt: "browser" } });
  });
  const stamp = Date.now();
  await signup(page, `usage-limit-${stamp}@rakazo.test`, "password12", "Usage Limit");
  await completeOnboarding(page);

  const notice = page.getByTestId("usage-limit-notice");
  await expect(notice).toContainText("Claude Code's 5-hour limit is used up.");
  await expect(notice).toContainText("Resets");
  await expect(notice.getByRole("button", { name: "Use ChatGPT" })).toBeVisible();
  const composer = page.getByTestId("composer-bar");
  expect((await notice.boundingBox())?.y).toBeLessThan((await composer.boundingBox())?.y ?? 0);
  await captureScreenshot(page, testInfo, "usage-limit-notice");

  usedPercent = 60;
  await page.reload();
  await expect(page.getByRole("combobox", { name: /^Message/ })).toBeVisible();
  await expect(page.getByTestId("usage-limit-notice")).toHaveCount(0);
});
