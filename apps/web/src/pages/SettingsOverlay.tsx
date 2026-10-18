import { useLingui } from "@lingui/react/macro";
import type { AvatarStyle } from "@milo/contracts";
import { Button, Dialog, DialogClose, DialogContent, DialogTitle } from "@milo/ui-web";
import {
  Bell,
  Brain,
  CloudDownload,
  Gauge,
  Monitor,
  Settings,
  ShieldCheck,
  Volume2,
  XIcon,
} from "lucide-react";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { ApprovalRulesSettings } from "../components/ApprovalRulesSettings";
import { computersAreUnavailable } from "../components/ComputersUnavailableHint";
import { NotificationSettings } from "../components/NotificationSettings";
import {
  ComputerSettingsPanel,
  GeneralSettingsPanels,
  UpdatesSettingsPanel,
  UsageSettingsPanel,
} from "./AccountSettingsOverlay";
import { AgentModelsPanel } from "./AgentModelsPanel";
import { SpaceMemorySection } from "./KnowledgeSection";
import { ModelSettingsOverlay } from "./ModelSettingsOverlay";
import { VoiceSettingsOverlay } from "./VoiceSettingsOverlay";

export type SettingsSection =
  | "general"
  | "usage"
  | "approvals"
  | "notifications"
  | "memory"
  | "voice"
  | "computer"
  | "updates";

type NavItem = {
  id: SettingsSection;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function SettingsOverlay({
  email,
  name,
  usage,
  initialSection = "general",
  avatarStyle,
  onAvatarStyleChange,
  isDeploymentOwner = false,
  modelManaged = false,
  sandboxProvider,
  onClose,
  onVoiceStatusMaybeChanged,
  onBotUpdated,
}: {
  email?: string | null;
  name: string;
  usage?: { runs: number; inputTokens: number; outputTokens: number } | null;
  initialSection?: SettingsSection;
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => Promise<void>;
  isDeploymentOwner?: boolean;
  modelManaged?: boolean;
  sandboxProvider?: string | null;
  onClose: () => void;
  onVoiceStatusMaybeChanged?: () => void | Promise<void>;
  onBotUpdated?: () => void;
}) {
  const { t } = useLingui();
  const panelRef = useRef<HTMLDivElement>(null);
  const usageRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const showComputer = isDeploymentOwner && computersAreUnavailable(sandboxProvider);
  const panelBusy = voiceBusy;

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (section === "usage") {
      usageRef.current?.focus();
    }
  }, [section]);

  const navItems: NavItem[] = [
    { id: "general", label: t`General`, icon: Settings },
    { id: "usage", label: t`Models`, icon: Gauge },
    { id: "approvals", label: t`Approvals`, icon: ShieldCheck },
    { id: "notifications", label: t`Notifications`, icon: Bell },
    { id: "memory", label: t`Memory`, icon: Brain },
    { id: "voice", label: t`Voice`, icon: Volume2 },
    ...(showComputer ? [{ id: "computer" as const, label: t`Computer`, icon: Monitor }] : []),
    { id: "updates", label: t`Updates`, icon: CloudDownload },
  ];

  const sectionTitle =
    navItems.find((item) => item.id === section)?.label ??
    (section === "general" ? t`General` : t`Settings`);

  const closeLabel =
    section === "usage"
      ? t`Close usage settings`
      : section === "memory"
        ? t`Close memory settings`
        : section === "voice"
          ? t`Close voice settings`
          : t`Close user settings`;

  async function refreshVoiceStatus() {
    await onVoiceStatusMaybeChanged?.();
  }

  function leaveSettings(next: () => void) {
    if (panelBusy) return;
    void refreshVoiceStatus().finally(next);
  }

  function requestClose() {
    leaveSettings(onClose);
  }

  const showModels = section === "usage" && !modelManaged;
  const widePane = showModels || section === "voice";

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (panelBusy) {
          details.cancel();
          return;
        }
        requestClose();
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
        className={`flex max-h-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-h-[calc(100%-5rem)] ${
          widePane
            ? "h-[min(760px,calc(100%-2rem))] w-[min(1080px,calc(100%-2rem))] sm:max-w-[1080px]"
            : "h-[min(720px,calc(100%-2rem))] w-[min(920px,calc(100%-2rem))] sm:max-w-[920px]"
        }`}
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
                  disabled={panelBusy}
                  onClick={() => setSection(item.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13.5px] transition-colors disabled:pointer-events-none disabled:opacity-50 ${
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
                disabled={panelBusy}
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <XIcon />
              </DialogClose>
            </div>

            <div
              className={`min-h-0 flex-1 ${
                showModels || section === "voice"
                  ? "flex flex-col overflow-hidden"
                  : "rk-scroll overflow-y-auto overscroll-contain px-6 pb-6 pt-5 sm:px-8 sm:pb-8"
              }`}
            >
              {section === "general" ? (
                <GeneralSettingsPanels
                  email={email}
                  name={name}
                  avatarStyle={avatarStyle}
                  onAvatarStyleChange={onAvatarStyleChange}
                  isDeploymentOwner={isDeploymentOwner}
                />
              ) : null}
              {section === "usage" && !showModels ? (
                <>
                  <UsageSettingsPanel usage={usage} panelRef={usageRef} ownKeys={false} />
                  <div className={usage ? "mt-6" : ""}>
                    <AgentModelsPanel />
                  </div>
                </>
              ) : null}
              {section === "approvals" ? <ApprovalRulesSettings /> : null}
              {section === "notifications" ? (
                <NotificationSettings onBotUpdated={onBotUpdated} />
              ) : null}
              {section === "computer" && showComputer ? <ComputerSettingsPanel /> : null}
              {section === "updates" ? (
                <UpdatesSettingsPanel isDeploymentOwner={isDeploymentOwner} />
              ) : null}
              {showModels ? (
                <>
                  <div className="px-6 pb-4 pt-5 sm:px-8">
                    <UsageSettingsPanel usage={usage} panelRef={usageRef} ownKeys />
                  </div>
                  <ModelSettingsOverlay embedded onClose={requestClose} />
                </>
              ) : null}
              {section === "memory" ? (
                <div data-testid="memory-settings">
                  <SpaceMemorySection />
                </div>
              ) : null}
              {section === "voice" ? (
                <VoiceSettingsOverlay embedded onClose={requestClose} onBusyChange={setVoiceBusy} />
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
