import type { ActionApprovalRule } from "@milo/contracts";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { rpc } from "../lib/api";
import { mobileTokens } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { native, useThemedStyles } from "../lib/native";

type Category = "email" | "purchase";
type Level = "act" | "ask";

function categoryRules(rules: ActionApprovalRule[], category: Category) {
  return rules.filter(
    (rule) =>
      (rule.effect === "require_approval" || rule.effect === "hand_off") &&
      rule.matchKind === "category" &&
      rule.matchValue === category,
  );
}

/** Space-wide levels per category: bots act by default, or ask first. */
export default function AllowList() {
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [rules, setRules] = useState<ActionApprovalRule[] | null>(null);
  const [saving, setSaving] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void rpc<ActionApprovalRule[]>("approvalRules/list")
      .then(setRules)
      .catch(() => setError(t("Could not load approval rules")));
  }, [t]);

  async function setLevel(category: Category, level: Level) {
    if (!rules || saving) return;
    const current = categoryRules(rules, category);
    if ((current.length > 0 ? "ask" : "act") === level) return;
    setSaving(category);
    setError(null);
    try {
      await Promise.all(current.map((rule) => rpc("approvalRules/remove", { id: rule.id })));
      const saved =
        level === "ask"
          ? await rpc<ActionApprovalRule>("approvalRules/set", {
              effect: "require_approval",
              matchKind: "category",
              matchValue: category,
            })
          : null;
      setRules((previous) => [
        ...(previous ?? []).filter((rule) => !current.includes(rule)),
        ...(saved ? [saved] : []),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not save rule"));
    } finally {
      setSaving(null);
    }
  }

  const categories: { id: Category; label: string }[] = [
    { id: "email", label: t("Email") },
    { id: "purchase", label: t("Purchases") },
  ];
  const levels: { id: Level; label: string }[] = [
    { id: "act", label: t("Act") },
    { id: "ask", label: t("Ask first") },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t("Allow list") }} />
      <View style={styles.group}>
        {categories.map((category) => {
          const current = rules && categoryRules(rules, category.id).length > 0 ? "ask" : "act";
          return (
            <View key={category.id} accessibilityLabel={category.label} style={styles.row}>
              <Text style={styles.label}>{category.label}</Text>
              <View style={styles.options}>
                {levels.map((level) => {
                  const selected = rules !== null && current === level.id;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${category.label}: ${level.label}`}
                      accessibilityState={{ selected, disabled: saving !== null }}
                      disabled={!rules || saving !== null}
                      onPress={() => void setLevel(category.id, level.id)}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.optionLabel}>{level.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function createStyles() {
  const tokens = mobileTokens();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: native.page },
    content: { padding: 20, gap: 12 },
    group: { borderRadius: 16, backgroundColor: native.fill, paddingHorizontal: 18 },
    row: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
    },
    label: { flex: 1, color: native.label, fontSize: 17, fontWeight: "600" },
    options: { flexDirection: "row", gap: 6 },
    option: {
      minHeight: 36,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: native.tertiaryLabel,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    optionSelected: { borderColor: native.label, backgroundColor: native.fillPressed },
    optionLabel: { color: native.label, fontSize: 14, fontWeight: "600" },
    error: { color: tokens.destructive, fontSize: 14 },
    pressed: { opacity: 0.7 },
  });
}
