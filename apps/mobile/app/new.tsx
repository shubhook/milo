import { type AgentStatus, BOT_DESCRIPTION_MAX_LENGTH, BOT_NAME_MAX_LENGTH } from "@milo/contracts";
import { BOT_PALETTE_COLORS } from "@milo/core";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { type MobileBot, rpc } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";

type RunsOn = "chatgpt" | "claude";

function claudeReady(status: AgentStatus | null): boolean {
  return Boolean(status?.installed && status.loggedIn);
}

export default function NewBot() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(BOT_PALETTE_COLORS[0]!);
  const [provider, setProvider] = useState<RunsOn>("chatgpt");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showRunsOn = claudeReady(agentStatus);

  useEffect(() => {
    void rpc<AgentStatus | null>("agent/status")
      .then(setAgentStatus)
      .catch(() => setAgentStatus(null));
  }, []);

  function close() {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  async function create() {
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    try {
      let title = "";
      let instructions = trimmedDescription;
      try {
        const refined = await rpc<{ title: string; instructions: string }>("bots/refine", {
          name: trimmedName,
          description: trimmedDescription,
        });
        title = refined.title;
        instructions = refined.instructions;
      } catch {
        // Create still works with the raw description when refine fails.
      }
      const usesClaude = showRunsOn && provider === "claude";
      const bot = await rpc<MobileBot>("bots/create", {
        name: trimmedName,
        title,
        description: trimmedDescription,
        instructions,
        notifyOnFinish: true,
        color: `${color}::shape_0`,
        ...(usesClaude ? { modelProvider: "claude-code", modelId: "sonnet" } : {}),
      });
      router.replace({ pathname: "/thread", params: { botId: bot.id, name: bot.name } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not create bot"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Pressable
              onPress={close}
              hitSlop={8}
              style={{ paddingEnd: 20, paddingVertical: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("Cancel")}
            >
              <Text style={{ color: tokens.foreground, fontSize: 17 }}>{t("Cancel")}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={{ color: tokens.mutedForeground, fontSize: 14 }}>{t("Name")}</Text>
        <TextInput
          value={name}
          maxLength={BOT_NAME_MAX_LENGTH}
          onChangeText={setName}
          placeholder={t("Name this bot")}
          placeholderTextColor={tokens.mutedForeground}
          style={{
            marginTop: 8,
            backgroundColor: tokens.muted,
            borderRadius: 11,
            padding: 16,
            color: tokens.foreground,
          }}
        />
        <Text style={{ color: tokens.mutedForeground, marginTop: 16, fontSize: 14 }}>
          {t("What should it do?")}
        </Text>
        <TextInput
          value={description}
          maxLength={BOT_DESCRIPTION_MAX_LENGTH}
          onChangeText={setDescription}
          placeholder={t("Describe what this bot does")}
          placeholderTextColor={tokens.mutedForeground}
          multiline
          style={{
            marginTop: 8,
            backgroundColor: tokens.muted,
            borderRadius: 11,
            padding: 16,
            color: tokens.foreground,
            minHeight: 120,
            textAlignVertical: "top",
          }}
        />
        <Text style={{ color: tokens.mutedForeground, marginTop: 16, fontSize: 14 }}>
          {t("Color")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {BOT_PALETTE_COLORS.map((swatch) => {
            const selected = color.toLowerCase() === swatch.toLowerCase();
            return (
              <Pressable
                key={swatch}
                onPress={() => setColor(swatch)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={swatch}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: swatch,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? tokens.foreground : tokens.border,
                }}
              />
            );
          })}
        </View>
        {showRunsOn ? (
          <>
            <Text style={{ color: tokens.mutedForeground, marginTop: 16, fontSize: 14 }}>
              {t("Runs on")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(
                [
                  { id: "chatgpt", label: t("ChatGPT") },
                  { id: "claude", label: t("Claude") },
                ] as const
              ).map((option) => {
                const selected = provider === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setProvider(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: selected ? tokens.foreground : tokens.border,
                      backgroundColor: selected ? tokens.muted : tokens.card,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: tokens.foreground }}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        {error ? <Text style={{ color: tokens.destructive, marginTop: 16 }}>{error}</Text> : null}
        <Pressable
          onPress={() => void create()}
          disabled={!name.trim() || pending}
          style={{
            marginTop: 24,
            backgroundColor: tokens.primary,
            borderRadius: 11,
            padding: 16,
            alignItems: "center",
            opacity: !name.trim() || pending ? 0.4 : 1,
          }}
        >
          <Text style={{ color: tokens.primaryForeground, fontSize: 16 }}>
            {pending ? t("Creating…") : t("Create")}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
