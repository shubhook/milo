// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ current: undefined as { update?: object } | undefined }));

const lingui = vi.hoisted(() => {
  const translate = (msg: { message?: string } | TemplateStringsArray) => {
    if (typeof msg === "object" && msg !== null && "message" in msg) {
      return String(msg.message ?? "");
    }
    return Array.from(msg as TemplateStringsArray).join("");
  };
  return { useLingui: () => ({ t: translate, _: translate }) };
});
vi.mock("@lingui/react/macro", () => lingui);
vi.mock("@lingui/react", () => lingui);
vi.mock("@milo/ui-web", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: () => null,
    Dialog: Pass,
    DialogClose: () => null,
    DialogContent: Pass,
    DialogTitle: Pass,
  };
});
vi.mock("../components/ApprovalRulesSettings", () => ({ ApprovalRulesSettings: () => null }));
vi.mock("../lib/desktop", () => ({ desktopBridge: () => bridge.current }));
vi.mock("./AccountSettingsOverlay", () => ({
  GeneralSettingsPanels: () => null,
  UpdatesSettingsPanel: () => null,
}));
vi.mock("./AgentModelsPanel", () => ({ AgentModelsPanel: () => null }));

import { SettingsOverlay } from "./SettingsOverlay";

afterEach(() => {
  bridge.current = undefined;
  vi.unstubAllGlobals();
});

async function navIds() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <SettingsOverlay
        name="Jamie"
        avatarStyle="robot"
        onAvatarStyleChange={async () => undefined}
        onClose={() => undefined}
      />,
    );
  });
  const ids = [...container.querySelectorAll("[data-testid^='settings-nav-']")].map((node) =>
    node.getAttribute("data-testid")?.replace("settings-nav-", ""),
  );
  await act(async () => root.unmount());
  container.remove();
  return ids;
}

it("lists Usage, General, Allow list and Updates in the desktop app", async () => {
  bridge.current = { update: {} };
  await expect(navIds()).resolves.toEqual(["usage", "general", "approvals", "updates"]);
});

it("leaves Updates out of a browser, which has nothing to update", async () => {
  await expect(navIds()).resolves.toEqual(["usage", "general", "approvals"]);
});
