// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const lingui = vi.hoisted(() => {
  const translate = (msg: { message?: string } | TemplateStringsArray, ...values: unknown[]) => {
    if (Array.isArray(msg)) {
      return (msg as TemplateStringsArray).reduce(
        (acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ""),
        "",
      );
    }
    if (msg && typeof msg === "object" && "message" in msg) return String(msg.message ?? "");
    return "";
  };
  return {
    useLingui: () => ({ t: translate, _: translate }),
    Trans: ({ children, message }: { children?: ReactNode; message?: string }) =>
      children ?? message ?? null,
  };
});
vi.mock("@lingui/react/macro", () => lingui);
vi.mock("@lingui/react", () => lingui);

vi.mock("@milo/ui-web", () => ({
  BotAvatar: () => null,
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Field: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FieldLabel: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
  Toggle: ({
    children,
    onPressedChange,
    pressed: _pressed,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    onPressedChange?: () => void;
    pressed?: boolean;
    variant?: string;
  } & React.ComponentProps<"button">) => (
    <button type="button" onClick={() => onPressedChange?.()} {...props}>
      {children}
    </button>
  ),
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

const rpcMock = vi.hoisted(() => ({
  models: { credentials: vi.fn() },
  connections: { catalog: vi.fn(), list: vi.fn(), revoke: vi.fn() },
}));
const connectCatalogApp = vi.hoisted(() => vi.fn());

vi.mock("../components/AgentLogo", () => ({ AgentLogo: () => null }));
vi.mock("../components/ai/primitives", () => ({
  Shimmer: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../components/DesktopUpdates", () => ({ DesktopUpdateSection: () => null }));
vi.mock("../lib/auth", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("../lib/connect-app", () => ({ connectCatalogApp }));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock, clearSpaceSelection: vi.fn() }));
vi.mock("../lib/i18n", () => ({
  getActiveUiLocale: () => "en",
  setUiLocale: (locale: string) => Promise.resolve(locale),
}));
vi.mock("../lib/ui-appearance", () => ({
  getUiAppearancePreference: () => "system",
  setUiAppearance: vi.fn(),
}));

import { TOOL_ACTIVITY_STORAGE_KEY } from "../lib/tool-activity-preference";
import { GeneralSettingsPanels } from "./AccountSettingsOverlay";

const gmail = {
  connectorId: "composio",
  slug: "gmail",
  name: "Gmail",
  logo: null,
  connected: false,
  noAuth: false,
};

beforeEach(() => {
  rpcMock.models.credentials.mockResolvedValue([{ provider: "chatgpt" }]);
  rpcMock.connections.catalog.mockResolvedValue([gmail]);
  rpcMock.connections.list.mockResolvedValue([]);
  rpcMock.connections.revoke.mockResolvedValue({ ok: true });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

async function renderGeneral() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GeneralSettingsPanels
        name="Jamie"
        email="jamie@example.test"
        avatarStyle="robot"
        onAvatarStyleChange={async () => undefined}
      />,
    );
  });
  return {
    container,
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

it("shows the v0 General rows without password, server or streaming settings", async () => {
  const view = await renderGeneral();
  try {
    const text = view.container.textContent ?? "";
    expect(view.container.querySelector('[data-testid="chatgpt-account"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="connected-apps"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="sign-out"]')).not.toBeNull();
    for (const hidden of ["Password", "Server integrations", "Stream replies"]) {
      expect(text).not.toContain(hidden);
    }
    expect(view.container.querySelector('[data-testid="response-streaming-toggle"]')).toBeNull();
  } finally {
    await view.unmount();
  }
});

it("connects and disconnects an app from General", async () => {
  connectCatalogApp.mockImplementation(async () => {
    rpcMock.connections.catalog.mockResolvedValue([{ ...gmail, connected: true }]);
    rpcMock.connections.list.mockResolvedValue([
      {
        id: "connection-1",
        connectorId: "composio",
        provider: "gmail",
        displayName: "Gmail",
        status: "connected",
        capabilities: [],
        createdAt: "2026-10-20T00:00:00.000Z",
      },
    ]);
    return "connected";
  });
  const view = await renderGeneral();
  try {
    const app = () => view.container.querySelector('[data-testid="connected-app-gmail"]');
    await act(async () => {
      app()?.querySelector("button")?.click();
      await connectCatalogApp.mock.results[0]?.value;
    });
    expect(connectCatalogApp).toHaveBeenCalledWith(gmail, "Gmail", expect.any(AbortSignal));
    expect(app()?.textContent).toContain("Disconnect");

    await act(async () => {
      app()?.querySelector("button")?.click();
      await rpcMock.connections.revoke.mock.results[0]?.value;
    });
    expect(rpcMock.connections.revoke).toHaveBeenCalledWith({ connectionId: "connection-1" });
  } finally {
    await view.unmount();
  }
});

it("flips the stored tool activity preference from the settings toggle", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <GeneralSettingsPanels
          name="Jamie"
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
        />,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="tool-activity-toggle"]',
    );
    if (!toggle) throw new Error("Missing tool activity toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle.click();
    });

    expect(localStorage.getItem(TOOL_ACTIVITY_STORAGE_KEY)).toBe("on");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      toggle.click();
    });

    expect(localStorage.getItem(TOOL_ACTIVITY_STORAGE_KEY)).toBe("off");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
