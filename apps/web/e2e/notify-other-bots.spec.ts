import { expect, type Route, test } from "@playwright/test";
import { activeBotId, completeOnboarding, createNamedBot, signup } from "./helpers";

test("a hidden tab alerts when another bot finishes", async ({ page }) => {
  await page.addInitScript(() => {
    const shown: { title: string; body: string }[] = [];
    (window as unknown as { shownNotifications: typeof shown }).shownNotifications = shown;
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(title: string, options?: { body?: string }) {
        shown.push({ title, body: options?.body ?? "" });
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FakeNotification });
    Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
    document.hasFocus = () => false;
  });
  await signup(page, `notify-others-${Date.now()}@rakazo.test`, "password12", "Notify Others");
  await completeOnboarding(page);
  const chiefId = activeBotId(page);
  await createNamedBot(page, "Atlas");

  let atlasStatus = "running";
  const withAtlasStatus = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withAtlasStatus);
    if (!value || typeof value !== "object") return value;
    const record = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, withAtlasStatus(entry)]),
    );
    return record.name === "Atlas" && "status" in record
      ? { ...record, status: atlasStatus }
      : record;
  };
  const rewrite = async (route: Route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: withAtlasStatus(await response.json()) });
  };
  await page.route("**/rpc/spaces/list", rewrite);
  await page.route("**/rpc/bootstrap", rewrite);
  // Watch Atlas from Chief's chat: the open chat alerts from its own stream instead.
  await page.goto(`/app/${chiefId}`);
  await expect(page.getByTestId("bots-sidebar").getByText("Atlas", { exact: true })).toBeVisible();

  atlasStatus = "completed";
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { shownNotifications: { title: string; body: string }[] })
              .shownNotifications,
        ),
      { timeout: 40_000 },
    )
    .toContainEqual({ title: "Atlas finished", body: "Finished." });
});
