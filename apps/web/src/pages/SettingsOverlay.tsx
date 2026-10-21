import { useLingui } from "@lingui/react/macro";
import type { AvatarStyle } from "@milo/contracts";
import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@milo/ui-web";
import { CloudDownload, Gauge, Settings, ShieldCheck, XIcon } from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { ApprovalRulesSettings } from "../components/ApprovalRulesSettings";
import { desktopBridge } from "../lib/desktop";
import { GeneralSettingsPanels, UpdatesSettingsPanel } from "./AccountSettingsOverlay";
import { AgentModelsPanel } from "./AgentModelsPanel";

export type SettingsSection = "general" | "usage" | "approvals" | "updates";

type NavItem = {
  id: SettingsSection;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

/** Settings is Usage, General, Allow list and Updates. */
export function SettingsOverlay({
  email,
  name,
  avatarStyle,
  onAvatarStyleChange,
  initialSection = "general",
  onClose,
}: {
  email?: string | null;
  name: string;
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => Promise<void>;
  initialSection?: SettingsSection;
  onClose: () => void;
  // Still passed by the shell; nothing in v0 settings reads them.
  usage?: { runs: number; inputTokens: number; outputTokens: number } | null;
  isDeploymentOwner?: boolean;
  modelManaged?: boolean;
  sandboxProvider?: string | null;
  onBotUpdated?: () => void;
}) {
  const { t } = useLingui();
  const panelRef = useRef<HTMLDivElement>(null);
  const usageRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<SettingsSection>(initialSection);
  // The desktop app updates itself; a browser has nothing to update here.
  const showUpdates = Boolean(desktopBridge()?.update);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (section === "usage") {
      usageRef.current?.focus();
    }
  }, [section]);

  const navItems: NavItem[] = [
    { id: "usage", label: t`Usage`, icon: Gauge },
    { id: "general", label: t`General`, icon: Settings },
    { id: "approvals", label: t`Allow list`, icon: ShieldCheck },
    ...(showUpdates ? [{ id: "updates" as const, label: t`Updates`, icon: CloudDownload }] : []),
  ];

  const sectionTitle =
    navItems.find((item) => item.id === section)?.label ??
    (section === "general" ? t`General` : t`Settings`);

  const closeLabel = section === "usage" ? t`Close usage settings` : t`Close user settings`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        onClose();
      }}
    >
      <DialogContent
        ref={panelRef}
        data-testid="user-settings"
        data-settings-section={section}
        showCloseButton={false}
        initialFocus={() =>
          section === "usage" ? (usageRef.current ?? panelRef.current) : panelRef.current
        }
        className="flex h-[min(720px,calc(100%-2rem))] max-h-[calc(100%-2rem)] w-[min(920px,calc(100%-2rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-h-[calc(100%-5rem)] sm:max-w-[920px]"
      >
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            data-testid="settings-nav"
            aria-label={t`Settings`}
            className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border px-3 py-3 md:w-[200px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-e md:px-3 md:py-4"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`settings-nav-${item.id}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(item.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] transition-colors ${
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
              <DialogTitle className="text-2xl font-medium text-foreground">
                {sectionTitle}
              </DialogTitle>
              <DialogClose
                aria-label={closeLabel}
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <XIcon />
              </DialogClose>
            </div>

            <div className="rk-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
              {section === "general" ? (
                <GeneralSettingsPanels
                  email={email}
                  name={name}
                  avatarStyle={avatarStyle}
                  onAvatarStyleChange={onAvatarStyleChange}
                />
              ) : null}
              {section === "usage" ? (
                <div
                  ref={usageRef}
                  tabIndex={-1}
                  data-testid="usage-settings"
                  className="min-h-8 outline-none"
                >
                  <AgentModelsPanel />
                </div>
              ) : null}
              {section === "approvals" ? <ApprovalRulesSettings /> : null}
              {section === "updates" && showUpdates ? <UpdatesSettingsPanel /> : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
