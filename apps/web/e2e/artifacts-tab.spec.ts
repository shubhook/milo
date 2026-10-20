import { expect, test } from "@playwright/test";
import { activeBotId, captureScreenshot, completeOnboarding, rpc, signup } from "./helpers";

test("opens Artifacts beside the sidebar and lists created files", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `artifacts-tab-${stamp}@rakazo.test`, "password12", "Artifacts Tab");
  await completeOnboarding(page);
  await page.goto("/app");
  await page.waitForURL(/\/app\/(?!artifacts(?:\/|$))[^/]+$/);
  const chiefId = activeBotId(page);

  await expect(page.getByTestId("app-rail")).toHaveCount(0);
  const sidebar = page.getByTestId("bots-sidebar");
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox())?.x).toBe(0);
  await expect(sidebar.getByRole("button", { name: "Integrations" })).toHaveCount(0);
  await expect(page.getByTestId("user-menu-trigger")).toHaveCount(0);
  const artifactsItem = sidebar.getByRole("button", { name: "Artifacts", exact: true });
  const settingsItem = sidebar.getByRole("button", { name: "Settings", exact: true });
  await expect(artifactsItem).toBeVisible();
  await expect(settingsItem).toBeVisible();
  expect((await artifactsItem.boundingBox())?.y).toBeLessThan(
    (await settingsItem.boundingBox())?.y ?? 0,
  );
  await captureScreenshot(page, testInfo, "sidebar-nav-artifacts");

  await artifactsItem.click();
  await expect(page).toHaveURL(/\/app\/artifacts$/);
  await expect(page.getByRole("heading", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect(artifactsItem).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("searchbox", { name: "Search artifacts…" })).toBeVisible();
  await expect(page.getByText("No artifacts found.")).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-empty");

  await page.setViewportSize({ width: 360, height: 700 });
  const narrowHeading = page.getByRole("heading", { name: "Artifacts", exact: true });
  const narrowCardView = page.getByRole("button", { name: "Card view" });
  await expect(narrowHeading).toBeVisible();
  await expect(narrowCardView).toBeVisible();
  const headingBox = await narrowHeading.boundingBox();
  const cardViewBox = await narrowCardView.boundingBox();
  expect(headingBox?.width).toBeGreaterThan(40);
  expect(headingBox?.x).toBeGreaterThanOrEqual(0);
  expect((headingBox?.x ?? 0) + (headingBox?.width ?? 0)).toBeLessThanOrEqual(360);
  expect(cardViewBox?.x).toBeGreaterThanOrEqual(0);
  expect((cardViewBox?.x ?? 0) + (cardViewBox?.width ?? 0)).toBeLessThanOrEqual(360);
  await page.setViewportSize({ width: 1280, height: 720 });

  await rpc(page, "artifacts/create", {
    botId: chiefId,
    name: "notes/artifacts-tab.md",
    mimeType: "text/markdown",
    contentBase64: Buffer.from("# Artifacts tab").toString("base64"),
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.getByText("notes/artifacts-tab.md")).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-list");

  await page.getByRole("link", { name: /notes\/artifacts-tab\.md/ }).click();
  await expect(page).toHaveURL(/\/app\/artifacts\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "notes/artifacts-tab.md" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Artifacts tab" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View chat" })).toHaveAttribute(
    "href",
    `/app/${chiefId}`,
  );
  await captureScreenshot(page, testInfo, "artifacts-preview");

  await page.getByRole("button", { name: "List view" }).click();
  await expect(page.getByRole("columnheader", { name: "Updated" })).toBeVisible();
  await captureScreenshot(page, testInfo, "artifacts-list-view");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/artifacts$/);

  const bots = await rpc<{ id: string; name: string }[]>(page, "bots/list", {});
  const chiefName = bots.find((bot) => bot.id === chiefId)?.name ?? "";
  await sidebar.getByText(chiefName, { exact: true }).first().click();
  await expect(page).toHaveURL(/\/app\/(?!artifacts(?:\/|$))[^/]+$/);
  await expect(page.getByTestId("transcript")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("app-rail")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileSidebar = page.getByTestId("bots-sidebar");
  await expect(mobileSidebar.getByRole("button", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(mobileSidebar.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "sidebar-nav-artifacts-mobile");
});
