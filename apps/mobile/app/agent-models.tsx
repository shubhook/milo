import type { AgentModel, ModelUsageWindow } from "@milo/contracts";
import { agentLogoForProvider, currentUsageWindow, usageWindowTone } from "@milo/core";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AgentLogo } from "../components/agent-logo";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useMobileTokens, useThemedStyles } from "../lib/native";
import { formatUsageReset, usageWindowLabel } from "../lib/usage-window";

/** Models the agent runtime runs bots on, with each plan's current usage limits. */
export default function AgentModels() {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [models, setModels] = useState<AgentModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rpc<AgentModel[]>("agent/models")
      .then((next) => {
        if (active) setModels(next);
      })
      .catch(() => {
        if (active) setError(t("Could not load models."));
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {!models && !error ? <ActivityIndicator color={native.secondaryLabel} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {models?.map((model) => {
          const logo = agentLogoForProvider(model.provider);
          return (
            <View key={model.provider} style={styles.card}>
              <View style={styles.header}>
                {logo ? <AgentLogo agent={logo} /> : null}
                <View style={styles.title}>
                  <Text style={styles.cardTitle}>{model.label}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {model.model}
                  </Text>
                </View>
                {model.inUse ? <Text style={styles.badge}>{t("In use")}</Text> : null}
              </View>
              {model.limits.length ? (
                model.limits.map((window) => (
                  <UsageWindow key={window.windowMinutes} window={currentUsageWindow(window)} />
                ))
              ) : (
                <Text style={styles.cardMeta}>{t("Limits show after the next run.")}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function UsageWindow({ window }: { window: ModelUsageWindow }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const used = Math.round(window.usedPercent);
  const tokens = useMobileTokens();
  const toneColor = { warning: tokens.warning, destructive: tokens.destructive };
  const tone = usageWindowTone(window.usedPercent);
  const resetsAt = window.resetsAt ? formatUsageReset(window.resetsAt) : null;
  return (
    <View style={styles.window}>
      <View style={styles.windowRow}>
        <Text style={styles.windowLabel}>{usageWindowLabel(window.windowMinutes)}</Text>
        <Text style={[styles.windowValue, tone !== "normal" && { color: toneColor[tone] }]}>
          {t("{used}% used", { used })}
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: used }}
      >
        <View
          style={[
            styles.indicator,
            { width: `${window.usedPercent}%` },
            tone !== "normal" && { backgroundColor: toneColor[tone] },
          ]}
        />
      </View>
      {resetsAt ? (
        <Text style={styles.cardMeta}>{t("Resets {time}", { time: resetsAt })}</Text>
      ) : null}
    </View>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    content: { padding: 20, gap: 10 },
    error: { color: tokens.destructive, marginBottom: 8 },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tokens.border,
      padding: 14,
      gap: 14,
      backgroundColor: tokens.card,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    title: { flex: 1, minWidth: 0 },
    cardTitle: { color: native.label, fontSize: 16 },
    cardMeta: { color: native.tertiaryLabel, marginTop: 4, fontSize: 12 },
    badge: {
      color: tokens.secondaryForeground,
      backgroundColor: tokens.secondary,
      borderRadius: 999,
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2,
      fontSize: 12,
      fontWeight: "500",
    },
    window: { gap: 6 },
    windowRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    windowLabel: { color: native.label, fontSize: 14 },
    windowValue: { color: native.secondaryLabel, fontSize: 13, fontVariant: ["tabular-nums"] },
    track: { height: 4, borderRadius: 999, backgroundColor: tokens.muted, overflow: "hidden" },
    indicator: { height: "100%", backgroundColor: tokens.primary },
  });
}
