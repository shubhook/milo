import type { Routine, RunActivityRow } from "@milo/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BotAvatar } from "../components/bot-avatar";
import { NativeSymbol } from "../components/native-symbol";
import {
  activityStatusLabel,
  fetchSpaceActivity,
  formatActivityRelativeTime,
} from "../lib/activity";
import type { MobileBot } from "../lib/api";
import { rpc } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";

type Tab = "activity" | "computer";

/** A bot's profile sheet: what it is doing, its routines, recent work, and its computer. */
export default function BotProfile() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const router = useRouter();
  const { botId } = useLocalSearchParams<{ botId?: string }>();
  const [bot, setBot] = useState<MobileBot | null>(null);
  const [tab, setTab] = useState<Tab>("activity");
  const [ongoing, setOngoing] = useState<RunActivityRow[]>([]);
  const [recent, setRecent] = useState<RunActivityRow[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    if (!botId) return;
    let active = true;
    void rpc<MobileBot>("bots/get", { botId })
      .then((next) => {
        if (active) setBot(next);
      })
      .catch(() => undefined);
    void fetchSpaceActivity()
      .then(({ active: running, recent: done }) => {
        if (!active) return;
        setOngoing(running.filter((run) => run.botId === botId));
        setRecent(done.filter((run) => run.botId === botId));
      })
      .catch(() => undefined);
    void rpc<Routine[]>("routines/list", { botId })
      .then((next) => {
        if (active) setRoutines(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [botId]);

  if (!botId) return null;

  const segment = (value: Tab, label: string) => (
    <Pressable
      key={value}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === value }}
      onPress={() => setTab(value)}
      style={[styles.segment, tab === value && { backgroundColor: tokens.card }]}
    >
      <Text style={{ color: tab === value ? tokens.foreground : tokens.mutedForeground }}>
        {label}
      </Text>
    </Pressable>
  );

  const runCard = (run: RunActivityRow) => (
    <View
      key={run.runId}
      style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
    >
      <Text numberOfLines={1} style={[styles.cardTitle, { color: tokens.foreground }]}>
        {run.promptSnippet || activityStatusLabel(run.status)}
      </Text>
      <Text style={[styles.cardMeta, { color: tokens.mutedForeground }]}>
        {`${activityStatusLabel(run.status)} · ${formatActivityRelativeTime(run.updatedAt)}`}
      </Text>
    </View>
  );

  const group = (label: string, children: React.ReactNode) => (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: tokens.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );

  const row = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { backgroundColor: tokens.card, borderColor: tokens.border }]}
    >
      <Text style={{ flex: 1, color: tokens.foreground, fontSize: 16 }}>{label}</Text>
      <NativeSymbol
        ios="chevron.right"
        android="chevron-forward"
        size={14}
        color={tokens.mutedForeground}
      />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.identity}>
        {bot ? (
          <BotAvatar color={bot.color} identity={bot.id} size={76} status={bot.status} />
        ) : null}
        <Text style={[styles.name, { color: tokens.foreground }]}>{bot?.name ?? ""}</Text>
        {bot?.title ? (
          <Text style={{ color: tokens.mutedForeground, fontSize: 15 }}>{bot.title}</Text>
        ) : null}
      </View>
      <View
        accessibilityRole="tablist"
        style={[styles.segments, { backgroundColor: tokens.muted }]}
      >
        {segment("activity", t("Activity"))}
        {segment("computer", t("Computer"))}
      </View>
      {tab === "activity" ? (
        <>
          {ongoing.length ? group(t("Now"), ongoing.map(runCard)) : null}
          {routines.length
            ? group(
                t("Routines"),
                routines.map((routine) => (
                  <Pressable
                    key={routine.id}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/routine",
                        params: { botId, botName: bot?.name ?? "", routineId: routine.id },
                      })
                    }
                    style={[
                      styles.card,
                      { backgroundColor: tokens.card, borderColor: tokens.border },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.cardTitle, { color: tokens.foreground }]}
                    >
                      {routine.name}
                    </Text>
                    <Text style={[styles.cardMeta, { color: tokens.mutedForeground }]}>
                      {routine.active ? t("Active") : t("Paused")}
                    </Text>
                  </Pressable>
                )),
              )
            : null}
          {recent.length ? group(t("Recent"), recent.map(runCard)) : null}
        </>
      ) : (
        row(t("Open computer"), () =>
          router.push({ pathname: "/computer", params: { botId, name: bot?.name ?? "" } }),
        )
      )}
      {row(t("Chat settings"), () => router.push({ pathname: "/bot-settings", params: { botId } }))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18 },
  identity: { alignItems: "center", gap: 6 },
  name: { fontSize: 20, fontWeight: "600" },
  segments: { flexDirection: "row", borderRadius: 999, padding: 3, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  group: { gap: 6 },
  groupLabel: { fontSize: 13, fontWeight: "500" },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "500" },
  cardMeta: { fontSize: 14, marginTop: 2 },
  row: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
});
