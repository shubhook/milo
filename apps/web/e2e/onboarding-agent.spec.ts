import { expect, test } from "@playwright/test";
import { captureScreenshot, reachMeetStep, signInWithChatGpt, signupWithEmail } from "./helpers";

test("an account without a ChatGPT plan connects it before meeting Chief", async ({
  page,
}, testInfo) => {
  // The desktop's local account is made without ChatGPT; an email account stands in for it.
  await page.route("**/rpc/agent/status", (route) =>
    route.fulfill({
      json: {
        json: {
          agent: "claude-code",
          chatgpt: false,
          installed: false,
          version: null,
          loggedIn: false,
          platform: "linux",
        },
      },
    }),
  );
  const stamp = Date.now();
  await signupWithEmail(page, `agent-chatgpt-${stamp}@rakazo.test`, "password12", "Plan");
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Connect your agent" })).toHaveCount(0);
  await signInWithChatGpt(page, `agent-chatgpt-plan-${stamp}@rakazo.test`, "Plan", testInfo);
  await reachMeetStep(page);
  await captureScreenshot(page, testInfo, "onboarding-chatgpt-linked");
});
