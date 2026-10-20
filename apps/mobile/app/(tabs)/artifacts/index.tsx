import type { Artifact } from "@milo/contracts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BotAvatar } from "../../../components/bot-avatar";
import type { MobileBot } from "../../../lib/api";
import { rpc } from "../../../lib/api";
import { openMobileArtifact } from "../../../lib/artifact-open";
import { useI18n } from "../../../lib/i18n";
import { formatThreadTime } from "../../../lib/inbox";
import { useMobileTokens } from "../../../lib/native";

type ArtifactSummary = Artifact & { versionCount: number };

function mimeLabel(mimeType: string): string {
  if (mimeType === "text/html") return "HTML";
  if (mimeType === "text/markdown") return "MD";
  if (mimeType === "application/pdf") return "PDF";
  const slash = mimeType.indexOf("/");
  return (slash === -1 ? mimeType : mimeType.slice(slash + 1)).toUpperCase().slice(0, 6);
}

/** Bot filter chips over a two-column grid; a card opens the file in the native viewer. */
export default function ArtifactsTab() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const [bots, setBots] = useState<MobileBot[]>([]);
  const [botId, setBotId] = useState<string | null>(null);
  const [items, setItems] = useState<ArtifactSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextBots, page] = await Promise.all([
        rpc<MobileBot[]>("bots/list"),
        rpc<{ items: ArtifactSummary[] }>("artifacts/listSpace", {
          botId: botId ?? undefined,
          limit: 60,
        }),
      ]);
      setBots(nextBots);
      setItems(page.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems((current) => current ?? []);
    }
  }, [botId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function open(item: ArtifactSummary) {
    const target = item.botId ? { botId: item.botId } : item.groupId ? { groupId: item.groupId } : null;
    if (!target) return;
    void openMobileArtifact(target, item.id, item.name, item.mimeType).catch((err: unknown) =>
      Alert.alert(item.name, err instanceof Error ? err.message : String(err)),
    );
  }

  const chip = (key: string, label: string, active: boolean, onPress: () => void, bot?: MobileBot) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: tokens.primary, borderColor: tokens.primary }
          : { backgroundColor: tokens.card, borderColor: tokens.border },
      ]}
    >
      {bot ? <BotAvatar color={bot.color} identity={bot.id} size={20} /> : null}
      <Text style={{ color: active ? tokens.primaryForeground : tokens.foreground, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentInsetAdjustmentBehavior="automatic"
      columnWrapperStyle={styles.columns}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
      ListHeaderComponent={
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {chip("all", t("All bots"), botId === null, () => setBotId(null))}
            {bots.map((bot) =>
              chip(bot.id, bot.name, botId === bot.id, () => setBotId(bot.id), bot),
            )}
          </ScrollView>
          {error ? (
            <Text style={[styles.note, { color: tokens.destructive }]}>{error}</Text>
          ) : null}
        </>
      }
      ListEmptyComponent={
        items ? (
          <Text style={[styles.note, { color: tokens.mutedForeground }]}>{t("No results")}</Text>
        ) : null
      }
      renderItem={({ item }) => {
        const bot = bots.find((candidate) => candidate.id === item.botId);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => open(item)}
            style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
          >
            <View style={[styles.preview, { backgroundColor: tokens.muted }]}>
              <Text style={[styles.kind, { color: tokens.mutedForeground }]}>
                {mimeLabel(item.mimeType)}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text numberOfLines={1} style={[styles.name, { color: tokens.foreground }]}>
                {item.name}
              </Text>
              <View style={styles.byline}>
                {bot ? <BotAvatar color={bot.color} identity={bot.id} size={16} /> : null}
                <Text numberOfLines={1} style={[styles.time, { color: tokens.mutedForeground }]}>
                  {[bot?.name, formatThreadTime(item.createdAt)].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  columns: { gap: 12 },
  chips: { gap: 8, paddingVertical: 8 },
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: { fontSize: 15, paddingVertical: 16 },
  card: {
    flex: 1,
    maxWidth: "50%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  preview: { aspectRatio: 16 / 11, alignItems: "flex-start", padding: 10 },
  kind: { fontSize: 11, fontWeight: "500" },
  meta: { padding: 12, gap: 4 },
  name: { fontSize: 15, fontWeight: "500" },
  byline: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { flex: 1, fontSize: 13 },
});
