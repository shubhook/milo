import type { AgentModel } from "@milo/contracts";
import { exhaustedUsageWindow } from "@milo/core";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { rpc } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";
import { formatUsageReset, isWeeklyUsageWindow, usageWindowLabel } from "../lib/usage-window";

/** Says when the plan bots run on is out until its window resets, above the composer. */
export function UsageLimitNotice({ refreshKey }: { refreshKey: unknown }) {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const [models, setModels] = useState<AgentModel[]>([]);
  const [, setClock] = useState(0);

  useEffect(() => {
    let active = true;
    void rpc<AgentModel[]>("agent/models")
      .then((next) => {
        if (active) setModels(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const blocked = exhaustedUsageWindow(models);
  // Clear the notice when the window resets.
  const resetTime = blocked?.window.resetsAt ? Date.parse(blocked.window.resetsAt) : null;
  useEffect(() => {
    if (resetTime === null) return;
    const timer = setTimeout(
      () => setClock((value) => value + 1),
      Math.max(0, Math.min(resetTime - Date.now(), 2 ** 31 - 1)),
    );
    return () => clearTimeout(timer);
  }, [resetTime]);

  if (!blocked) return null;
  const { model, window: usage } = blocked;
  const limit = isWeeklyUsageWindow(usage.windowMinutes)
    ? t("{agent}'s weekly limit is used up.", { agent: model.label })
    : t("{agent}'s {period} limit is used up.", {
        agent: model.label,
        period: usageWindowLabel(usage.windowMinutes),
      });
  const reset = usage.resetsAt
    ? ` ${t("Resets {time}", { time: formatUsageReset(usage.resetsAt) })}`
    : "";
  return (
    <View
      accessibilityRole="alert"
      testID="usage-limit-notice"
      style={{
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: tokens.destructiveSurface,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: tokens.foreground, fontSize: 15 }}>
        {limit}
        {reset}
      </Text>
    </View>
  );
}
