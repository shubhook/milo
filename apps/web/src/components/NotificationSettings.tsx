import { Trans } from "@lingui/react/macro";
import type { Bot } from "@milo/contracts";
import { BotAvatar, Label, Switch } from "@milo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";

/** One switch per bot for the existing notify-on-finish setting. */
export function NotificationSettings({ onBotUpdated }: { onBotUpdated?: () => void }) {
  const ids = useId();
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rpc.bots
      .list()
      .then((next) => {
        if (active) setBots(next);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  async function setNotify(bot: Bot, notifyOnFinish: boolean) {
    setSaving(bot.id);
    setError(null);
    try {
      const updated = await rpc.bots.update({ botId: bot.id, notifyOnFinish });
      setBots((current) => current?.map((item) => (item.id === bot.id ? updated : item)) ?? null);
      onBotUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div data-testid="notification-settings">
      {bots?.map((bot) => (
        <div key={bot.id} className="flex items-center gap-3 border-b border-border py-3">
          <BotAvatar color={bot.color} identity={bot.id} size={28} />
          <Label
            htmlFor={`${ids}-${bot.id}`}
            className="min-w-0 flex-1 truncate text-body font-medium"
          >
            {bot.name}
          </Label>
          <Switch
            id={`${ids}-${bot.id}`}
            checked={bot.notifyOnFinish}
            disabled={saving === bot.id}
            onCheckedChange={(checked) => void setNotify(bot, checked)}
          />
        </div>
      ))}
      {bots?.length === 0 ? (
        <p className="py-3 text-muted-foreground">
          <Trans>No bots</Trans>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-small text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
