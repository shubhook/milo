import { expect, type Route, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, createNamedBot, signup } from "./helpers";

/** Mark every bot named Atlas as waiting on the person, wherever the payload lists it. */
function markWaiting(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(markWaiting);
  if (!value || typeof value !== "object") return value;
  const record = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, markWaiting(entry)]),
  );
  return record.name === "Atlas" && "status" in record
    ? { ...record, status: "waiting_input" }
    : record;
}

async function rewrite(route: Route) {
  const response = await route.fetch();
  await route.fulfill({ response, json: markWaiting(await response.json()) });
}

test("bots waiting on you are grouped at the top of the sidebar", async ({ page }, testInfo) => {
  await signup(page, `needs-you-${Date.now()}@rakazo.test`, "password12", "Needs You");
  await completeOnboarding(page);
  await createNamedBot(page, "Atlas");
  await page.route("**/rpc/bootstrap", rewrite);
  await page.route("**/rpc/spaces/list", rewrite);
  await page.reload();

  const sidebar = page.getByTestId("bots-sidebar");
  const needsYou = sidebar.locator('[data-sidebar-group="needs-you"]');
  await expect(needsYou.getByText("Needs you", { exact: true })).toBeVisible();
  await expect(needsYou.getByText("Atlas", { exact: true })).toBeVisible();
  await expect(needsYou.getByText("Chief", { exact: true })).toHaveCount(0);
  const atlasBox = await needsYou.getByText("Atlas", { exact: true }).boundingBox();
  const chiefBox = await sidebar.getByText("Chief", { exact: true }).first().boundingBox();
  expect(atlasBox?.y).toBeLessThan(chiefBox?.y ?? 0);
  await captureScreenshot(page, testInfo, "sidebar-needs-you");
});
