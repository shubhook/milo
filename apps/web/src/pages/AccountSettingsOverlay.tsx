import { Trans, useLingui } from "@lingui/react/macro";
import type { AvatarStyle, Connection, ConnectionCatalogItem } from "@milo/contracts";
import { buildFeaturedConnectorTiles } from "@milo/core";
import { BotAvatar, Button, Label, Switch, Toggle } from "@milo/ui-web";
import { ChevronDown } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AgentLogo } from "../components/AgentLogo";
import { Shimmer } from "../components/ai/primitives";
import { DesktopUpdateSection } from "../components/DesktopUpdates";
import { authClient } from "../lib/auth";
import { connectCatalogApp } from "../lib/connect-app";
import { getActiveUiLocale, setUiLocale } from "../lib/i18n";
import { clearSpaceSelection, rpc } from "../lib/rpc";
import {
  getToolActivityPreference,
  setToolActivityPreference,
} from "../lib/tool-activity-preference";
import type { AppearancePreference } from "../lib/ui-appearance";
import { getUiAppearancePreference, setUiAppearance } from "../lib/ui-appearance";
import type { UiLocale } from "../lib/ui-locale";
import { UI_LOCALE_LABELS, UI_LOCALES } from "../lib/ui-locale";

export type SettingsGeneralProps = {
  email?: string | null;
  name: string;
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => Promise<void>;
};

export function GeneralSettingsPanels({
  email,
  name,
  avatarStyle,
  onAvatarStyleChange,
}: SettingsGeneralProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [locale, setLocale] = useState<UiLocale>(() => getActiveUiLocale());
  const localeRequestRef = useRef(0);
  const [appearance, setAppearance] = useState<AppearancePreference>(() =>
    getUiAppearancePreference(),
  );
  const [chatgpt, setChatgpt] = useState(false);
  const [showToolActivity, setShowToolActivity] = useState(
    () => getToolActivityPreference() === "on",
  );
  const showToolActivityId = useId();
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rpc.models
      .credentials()
      .then((rows) => {
        if (active) setChatgpt(rows.some((row) => row.provider === "chatgpt"));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function chooseLocale(next: UiLocale) {
    if (next === locale) return;
    const requestId = ++localeRequestRef.current;
    setLocale(next);
    void setUiLocale(next).then((activated) => {
      if (requestId !== localeRequestRef.current) return;
      setLocale(activated);
    });
  }

  async function chooseAvatarStyle(next: AvatarStyle) {
    if (avatarPending || next === avatarStyle) return;
    setAvatarPending(true);
    setAvatarError(null);
    try {
      await onAvatarStyleChange(next);
    } catch {
      setAvatarError(t`Couldn't update avatars`);
    } finally {
      setAvatarPending(false);
    }
  }

  return (
    <div>
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3.5">
        <h3 className="flex-1 text-body font-medium text-foreground">
          <Trans>Account</Trans>
        </h3>
        <div className="min-w-0 text-end">
          <p className="truncate text-foreground">{name}</p>
          {email ? <p className="truncate text-small text-muted-foreground">{email}</p> : null}
        </div>
      </section>

      {chatgpt ? (
        <section
          data-testid="chatgpt-account"
          className="flex items-center gap-3 border-b border-border py-3.5"
        >
          <AgentLogo agent="openai" size={24} />
          <h3 className="flex-1 text-body font-medium text-foreground">ChatGPT</h3>
          <span className="text-small text-muted-foreground">
            <Trans>Connected</Trans>
          </span>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3.5">
        <h3 className="flex-1 text-body font-medium text-foreground">
          <Trans>Appearance</Trans>
        </h3>
        <AppearancePicker
          value={appearance}
          onChange={(next) => {
            setAppearance(next);
            setUiAppearance(next);
          }}
        />
      </section>

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3.5">
        <h3 className="flex-1 text-body font-medium text-foreground">
          <Trans>Language</Trans>
        </h3>
        <UiLocalePicker value={locale} onChange={chooseLocale} />
      </section>

      <section className="border-b border-border py-3.5" data-testid="avatar-style-select">
        <h3 className="text-body font-medium text-foreground">
          <Trans>Avatars</Trans>
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["robot", "organic"] as const).map((style) => (
            <Toggle
              key={style}
              variant="outline"
              pressed={style === avatarStyle}
              disabled={avatarPending}
              onPressedChange={() => void chooseAvatarStyle(style)}
              data-testid={`avatar-style-${style}`}
              className="h-auto justify-start gap-3 px-3.5 py-3 text-[14px] font-normal"
            >
              <BotAvatar
                color="#D9508A"
                identity="avatar-style-preview"
                size={32}
                variant={style}
              />
              <span>{style === "robot" ? <Trans>Robot</Trans> : <Trans>Organic</Trans>}</span>
            </Toggle>
          ))}
        </div>
        {avatarError ? (
          <p role="alert" className="mt-3 text-[12.5px] text-destructive">
            {avatarError}
          </p>
        ) : null}
      </section>

      <ConnectedAppsSection />

      <div className="flex items-start gap-3 border-b border-border py-3.5">
        <Switch
          id={showToolActivityId}
          data-testid="tool-activity-toggle"
          className="mt-0.5"
          checked={showToolActivity}
          onCheckedChange={(checked) => {
            setShowToolActivity(checked);
            setToolActivityPreference(checked ? "on" : "off");
          }}
        />
        <Label htmlFor={showToolActivityId} className="text-[14px] font-normal text-foreground/75">
          <Trans>Show tool activity</Trans>
        </Label>
      </div>

      <div className="pt-5">
        <Button
          variant="outline"
          data-testid="sign-out"
          onClick={() =>
            void authClient.signOut().then(() => {
              clearSpaceSelection();
              navigate("/");
            })
          }
        >
          <Trans>Log out</Trans>
        </Button>
      </div>
    </div>
  );
}

/** The featured catalog apps plus any other connected app, each with Connect or Disconnect. */
function ConnectedAppsSection() {
  const { t } = useLingui();
  const [catalog, setCatalog] = useState<ConnectionCatalogItem[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<AbortController | null>(null);

  async function refresh() {
    const [nextCatalog, nextConnections] = await Promise.all([
      rpc.connections.catalog({}),
      rpc.connections.list(),
    ]);
    setCatalog(nextCatalog);
    setConnections(nextConnections);
  }

  useEffect(() => {
    void refresh().catch(() => setCatalog([]));
    return () => attempt.current?.abort();
  }, []);

  if (!catalog?.length) return null;
  const featured = buildFeaturedConnectorTiles(catalog).flatMap((tile) =>
    tile.item ? [{ label: tile.label, item: tile.item }] : [],
  );
  const apps = [
    ...featured,
    ...catalog
      .filter((item) => item.connected && !featured.some((app) => app.item === item))
      .map((item) => ({ label: item.name, item })),
  ];

  async function connect(label: string, item: ConnectionCatalogItem) {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    setPending(item.slug);
    setError(null);
    try {
      const outcome = await connectCatalogApp(item, label, controller.signal);
      if (outcome === "pending") setError(t`Connection to ${label} is still pending.`);
      await refresh();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : t`Could not connect`);
      }
    } finally {
      if (attempt.current === controller) {
        attempt.current = null;
        setPending(null);
      }
    }
  }

  async function disconnect(item: ConnectionCatalogItem) {
    setPending(item.slug);
    setError(null);
    try {
      for (const row of appConnections(connections, item)) {
        await rpc.connections.revoke({ connectionId: row.id });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not revoke connection`);
    } finally {
      setPending(null);
    }
  }

  return (
    <section data-testid="connected-apps" className="border-b border-border py-3.5">
      <h3 className="text-body font-medium text-foreground">
        <Trans>Apps</Trans>
      </h3>
      <ul className="m-0 mt-2 list-none p-0">
        {apps.map(({ label, item }) => (
          <li
            key={`${item.connectorId}:${item.slug}`}
            data-testid={`connected-app-${item.slug}`}
            className="flex items-center gap-3 py-2"
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
            >
              {item.logo ? (
                <img src={item.logo} alt="" className="size-4.5 object-contain" />
              ) : (
                label.charAt(0)
              )}
            </span>
            <span className="flex-1 text-foreground">{label}</span>
            {pending === item.slug ? (
              <Shimmer>
                <Trans>Connecting…</Trans>
              </Shimmer>
            ) : item.connected ? (
              <Button
                variant="ghost"
                disabled={pending !== null}
                aria-label={t`Disconnect ${label}`}
                onClick={() => void disconnect(item)}
              >
                <Trans>Disconnect</Trans>
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending !== null}
                aria-label={t`Connect ${label}`}
                onClick={() => void connect(label, item)}
              >
                <Trans>Connect</Trans>
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-small text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function appConnections(connections: Connection[], item: ConnectionCatalogItem) {
  return connections.filter(
    (row) =>
      row.connectorId === item.connectorId &&
      row.provider === item.slug &&
      (row.status === "connected" || row.status === "pending"),
  );
}

export function UpdatesSettingsPanel() {
  return <DesktopUpdateSection />;
}

function AppearancePicker({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
}) {
  const { t } = useLingui();
  const options: { value: AppearancePreference; label: string }[] = [
    { value: "light", label: t`Light` },
    { value: "dark", label: t`Dark` },
    { value: "system", label: t`System` },
  ];

  return (
    <fieldset
      aria-label={t`Appearance`}
      data-testid="ui-appearance-select"
      className="m-0 inline-flex w-fit gap-0.5 rounded-full border-0 bg-muted p-[3px]"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          data-testid={`ui-appearance-${option.value}`}
          pressed={option.value === value}
          onPressedChange={() => onChange(option.value)}
          size="sm"
          className="h-7 rounded-full px-3 text-small font-normal text-muted-foreground hover:bg-transparent aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-raised"
        >
          {option.label}
        </Toggle>
      ))}
    </fieldset>
  );
}

function UiLocalePicker({
  value,
  onChange,
}: {
  value: UiLocale;
  onChange: (locale: UiLocale) => void;
}) {
  const { t } = useLingui();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const selectedIndex = Math.max(0, UI_LOCALES.indexOf(value));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);

  useEffect(() => {
    setHighlightedIndex(selectedIndex);
    setOpen(false);
  }, [selectedIndex, value]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, open]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function choose(index: number) {
    const next = UI_LOCALES[index];
    if (!next) return;
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveHighlight(index: number) {
    setHighlightedIndex((index + UI_LOCALES.length) % UI_LOCALES.length);
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(UI_LOCALES.length - 1);
    }
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(UI_LOCALES.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-[220px]">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        data-testid="ui-locale-select"
        aria-label={t`Language`}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-start text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{UI_LOCALE_LABELS[value]}</span>
        <span className="ml-3 shrink-0 text-muted-foreground" aria-hidden="true">
          <ChevronDown size={16} strokeWidth={1.8} />
        </span>
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t`Language`}
          className="rk-scroll absolute left-0 right-0 top-full z-20 mt-1 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {UI_LOCALES.map((code, index) => (
            <button
              key={code}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={code === value}
              tabIndex={index === highlightedIndex ? 0 : -1}
              className={`w-full rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent focus-visible:bg-accent ${
                code === value ? "bg-accent" : ""
              }`}
              onClick={() => choose(index)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              {UI_LOCALE_LABELS[code]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
