import type { Routine } from "@milo/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { BotAvatar } from "../../../components/bot-avatar";
import type { MobileBot } from "../../../lib/api";
import { rpc } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { useMobileTokens } from "../../../lib/native";

type Row = { routine: Routine; bot: MobileBot };

/** Every routine in the space; a row opens its detail sheet. */
export default function RoutinesTab() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const bots = await rpc<MobileBot[]>("bots/list");
      const lists = await Promise.all(
        bots.map((bot) =>
          rpc<Routine[]>("routines/list", { botId: bot.id })
            .then((routines) => routines.map((routine) => ({ routine, bot })))
            .catch(() => []),
        ),
      );
      setRows(lists.flat().sort((a, b) => a.routine.name.localeCompare(b.routine.name)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows((current) => current ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <FlatList
      data={rows ?? []}
      keyExtractor={(row) => row.routine.id}
      contentInsetAdjustmentBehavior="automatic"
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
        error ? <Text style={[styles.note, { color: tokens.destructive }]}>{error}</Text> : null
      }
      ListEmptyComponent={
        rows ? (
          <Text style={[styles.note, { color: tokens.mutedForeground }]}>{t("No results")}</Text>
        ) : null
      }
      renderItem={({ item: { routine, bot } }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/routine",
              params: { botId: bot.id, botName: bot.name, routineId: routine.id },
            })
          }
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: tokens.border },
            pressed && { backgroundColor: tokens.muted },
          ]}
        >
          <BotAvatar color={bot.color} identity={bot.id} size={40} />
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.title, { color: tokens.foreground }]}>
              {routine.name}
            </Text>
            <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.mutedForeground }]}>
              {bot.name}
            </Text>
          </View>
          <Text
            style={[
              styles.state,
              {
                color: routine.active ? tokens.success : tokens.mutedForeground,
                backgroundColor: tokens.muted,
              },
            ]}
          >
            {routine.active ? t("Active") : t("Paused")}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  note: { fontSize: 15, paddingHorizontal: 20, paddingVertical: 16 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "500" },
  subtitle: { fontSize: 14, marginTop: 2 },
  state: {
    fontSize: 13,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
