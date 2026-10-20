import type { AvatarStyle, Connection, ConnectionCatalogItem } from "@milo/contracts";
import { abortableDelay, buildFeaturedConnectorTiles } from "@milo/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AgentLogo } from "../../../components/agent-logo";
import { useAvatarStyle } from "../../../components/avatar-style";
import { BotAvatar } from "../../../components/bot-avatar";
import type { MobileMe, MobileModelCredential } from "../../../lib/api";
import { rpc, signOut } from "../../../lib/api";
import { formatUpdateLabel, getAppVersionInfo } from "../../../lib/app-version";
import {
  getCachedAppearancePreference,
  mobileTokens,
  setAppearancePreference,
} from "../../../lib/appearance";
import { explicitSignInRoute } from "../../../lib/auth-routing";
import { setUiLocale, useI18n } from "../../../lib/i18n";
import { presentMessageActionSheet } from "../../../lib/message-action-sheet";
import { native, useResolvedAppearance, useThemedStyles } from "../../../lib/native";
import type { AccountUiLocale } from "../../../lib/ui-locale";
import { ACCOUNT_UI_LOCALES, UI_LOCALE_LABELS } from "../../../lib/ui-locale";

/** Settings is Usage, General, Allow list and Updates. Voice stays until thread C removes it. */
export default function Account() {
  const { t, locale } = useI18n();
  const colorScheme = useResolvedAppearance();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const [me, setMe] = useState<MobileMe | null>(null);
  const [chatgpt, setChatgpt] = useState(false);
  const [localeSaving, setLocaleSaving] = useState(false);
  const [localeError, setLocaleError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { avatarStyle, updateAvatarStyle } = useAvatarStyle();
  const appearance = getCachedAppearancePreference();
  const styles = useThemedStyles(createAccountStyles);
  const versionInfo = getAppVersionInfo();
  const updateLabel = formatUpdateLabel(versionInfo.update, t);
  const versionAccessibility = [versionInfo.nativeLabel, updateLabel].filter(Boolean).join(". ");

  useEffect(() => {
    void rpc<MobileMe>("me")
      .then(setMe)
      .catch(() => undefined);
    void rpc<MobileModelCredential[]>("models/credentials")
      .then((rows) => setChatgpt(rows.some((row) => row.provider === "chatgpt")))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (focus === "usage") router.push("/agent-models");
  }, [focus, router]);

  async function selectAvatarStyle(next: AvatarStyle) {
    if (next === avatarStyle) return;
    setAvatarPending(true);
    setAvatarError(null);
    try {
      await updateAvatarStyle(next);
    } catch {
      setAvatarError(t("Couldn't update avatars"));
    } finally {
      setAvatarPending(false);
    }
  }

  async function handleSignOut() {
    setPending(true);
    setError(null);
    try {
      await signOut();
      router.dismissAll();
      router.replace(explicitSignInRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not sign out"));
      setPending(false);
    }
  }

  function applyLocale(code: AccountUiLocale) {
    if (code === locale || localeSaving) return;
    setLocaleSaving(true);
    setLocaleError(null);
    void setUiLocale(code)
      .catch(() => {
        setLocaleError(t("Could not change language"));
      })
      .finally(() => setLocaleSaving(false));
  }

  function openLanguagePicker() {
    if (localeSaving) return;
    presentMessageActionSheet({
      title: t("Language"),
      actions: ACCOUNT_UI_LOCALES.map((code) => ({
        text: UI_LOCALE_LABELS[code],
        onPress: () => applyLocale(code),
      })),
      colorScheme,
      cancel: t("Cancel"),
      more: t("More"),
    });
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.navGroup}>
          <NavRow
            label={t("Usage")}
            onPress={() => router.push("/agent-models")}
            styles={styles}
          />
          <NavRow
            label={t("Allow list")}
            onPress={() => router.push("/allow-list")}
            styles={styles}
          />
          <NavRow label={t("Voice")} onPress={() => router.push("/voice")} styles={styles} />
        </View>

        <Text style={styles.sectionLabel}>{t("General")}</Text>
        <View style={styles.profile}>
          <Text style={styles.name}>{me?.name || t("Your account")}</Text>
          {me?.email ? <Text style={styles.email}>{me.email}</Text> : null}
        </View>

        {chatgpt ? (
          <View accessibilityLabel={t("ChatGPT")} style={styles.chatgptRow}>
            <AgentLogo agent="openai" size={28} />
            <Text style={styles.settingsTitle}>ChatGPT</Text>
            <Text style={styles.settingsValue}>{t("Connected")}</Text>
          </View>
        ) : null}

        <View accessibilityLabel={t("Appearance")} style={styles.avatarSection}>
          <Text style={styles.settingsTitle}>{t("Appearance")}</Text>
          <View style={styles.appearanceOptions}>
            {(
              [
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ] as const
            ).map(([value, label]) => {
              const selected = appearance === value;
              const translated = t(label);
              return (
                <Pressable
                  key={value}
                  accessibilityLabel={translated}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => void setAppearancePreference(value)}
                  style={({ pressed }) => [
                    styles.appearanceOption,
                    selected && styles.appearanceOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.appearanceLabel}>{translated}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View accessibilityLabel={t("Avatar style")} style={styles.avatarSection}>
          <Text style={styles.settingsTitle}>{t("Avatars")}</Text>
          <View style={styles.avatarOptions}>
            {(["robot", "organic"] as const).map((style) => {
              const selected = avatarStyle === style;
              const styleLabel = style === "robot" ? t("Robot") : t("Organic");
              return (
                <Pressable
                  key={style}
                  accessibilityLabel={t("{style} avatars", { style: styleLabel })}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: avatarPending }}
                  disabled={avatarPending}
                  onPress={() => void selectAvatarStyle(style)}
                  style={({ pressed }) => [
                    styles.avatarOption,
                    selected && styles.avatarOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <BotAvatar
                    color={style === "robot" ? "#8B5CF6" : "#D62F8B"}
                    identity="avatar-preview"
                    size={42}
                    variant={style}
                  />
                  <Text style={styles.avatarLabel}>{styleLabel}</Text>
                </Pressable>
              );
            })}
          </View>
          {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Language")}
          accessibilityValue={{ text: UI_LOCALE_LABELS[locale] }}
          accessibilityState={{ disabled: localeSaving }}
          disabled={localeSaving}
          onPress={openLanguagePicker}
          style={({ pressed }) => [
            styles.settingsButton,
            pressed && styles.pressed,
            localeSaving && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.settingsTitle}>{t("Language")}</Text>
          <View style={styles.settingsTrailing}>
            <Text style={styles.settingsValue}>{UI_LOCALE_LABELS[locale]}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
        {localeError ? <Text style={styles.error}>{localeError}</Text> : null}

        <ConnectedAppsSection styles={styles} />

        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>{t("Sign out")}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {(versionInfo.nativeLabel || updateLabel) && (
          <>
            <Text style={styles.sectionLabel}>{t("Updates")}</Text>
            <View
              accessibilityLabel={versionAccessibility}
              accessibilityRole="summary"
              style={styles.versionCard}
            >
              {versionInfo.nativeLabel ? (
                <Text style={styles.versionLine}>{versionInfo.nativeLabel}</Text>
              ) : null}
              {updateLabel ? <Text style={styles.versionLine}>{updateLabel}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NavRow({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createAccountStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
    >
      <Text style={styles.settingsTitle}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ConnectedAppsSection({ styles }: { styles: ReturnType<typeof createAccountStyles> }) {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<ConnectionCatalogItem[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<AbortController | null>(null);

  async function refresh() {
    const [nextCatalog, nextConnections] = await Promise.all([
      rpc<ConnectionCatalogItem[]>("connections/catalog"),
      rpc<Connection[]>("connections/list"),
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
      const started = await rpc<{ connectionId: string; authorizationUrl: string | null }>(
        "connections/begin",
        {
          connectorId: item.connectorId,
          provider: item.slug,
          displayName: label,
        },
      );
      if (started.authorizationUrl) await Linking.openURL(started.authorizationUrl);
      for (let i = 0; i < 45; i += 1) {
        if (controller.signal.aborted) return;
        const row = await rpc<Connection>("connections/complete", {
          connectionId: started.connectionId,
        }).catch(() => undefined);
        if (row?.status === "connected") {
          await refresh();
          return;
        }
        await abortableDelay(2_000, controller.signal);
      }
      if (!controller.signal.aborted) {
        Alert.alert(
          t("Connection pending"),
          t("Finish connecting in the browser, then refresh this page."),
        );
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : t("Could not connect"));
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
      const matches = connections.filter(
        (row) =>
          row.connectorId === item.connectorId &&
          row.provider === item.slug &&
          (row.status === "connected" || row.status === "pending"),
      );
      for (const row of matches) {
        await rpc("connections/revoke", { connectionId: row.id });
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not revoke connection"));
    } finally {
      setPending(null);
    }
  }

  return (
    <View accessibilityLabel={t("Apps")} style={styles.appsSection}>
      <Text style={styles.settingsTitle}>{t("Apps")}</Text>
      {apps.map(({ label, item }) => (
        <View key={`${item.connectorId}:${item.slug}`} style={styles.appRow}>
          <AppLogo logo={item.logo} label={label} styles={styles} />
          <Text style={styles.appName}>{label}</Text>
          {pending === item.slug ? (
            <ActivityIndicator color={native.secondaryLabel} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.connected ? t("Disconnect") : t("Connect")} ${label}`}
              disabled={pending !== null}
              onPress={() => void (item.connected ? disconnect(item) : connect(label, item))}
              hitSlop={8}
            >
              <Text style={styles.appAction}>
                {item.connected ? t("Disconnect") : t("Connect")}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function AppLogo({
  logo,
  label,
  styles,
}: {
  logo?: string | null;
  label: string;
  styles: ReturnType<typeof createAccountStyles>;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logo]);
  if (!logo || failed) {
    return (
      <View style={styles.logoFallback}>
        <Text style={styles.logoInitial}>{(label.trim()[0] || "?").toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      onError={() => setFailed(true)}
      resizeMode="contain"
      source={{ uri: logo }}
      style={styles.logo}
    />
  );
}

function createAccountStyles() {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: native.page,
    },
    content: {
      flexGrow: 1,
      padding: 20,
      gap: 16,
    },
    navGroup: {
      borderRadius: 16,
      backgroundColor: native.fill,
      overflow: "hidden",
    },
    navRow: {
      minHeight: 52,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionLabel: {
      color: native.secondaryLabel,
      fontSize: 13,
      fontWeight: "600",
      textTransform: "uppercase",
      marginTop: 8,
      marginLeft: 4,
    },
    profile: {
      borderRadius: 16,
      backgroundColor: native.fill,
      padding: 18,
      gap: 4,
    },
    name: {
      color: native.label,
      fontSize: 20,
      fontWeight: "600",
    },
    email: {
      color: native.secondaryLabel,
      fontSize: 15,
    },
    chatgptRow: {
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: native.fill,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    button: {
      minHeight: 50,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: native.fill,
    },
    buttonLabel: {
      color: native.label,
      fontSize: 17,
      fontWeight: "600",
    },
    settingsButton: {
      minHeight: 62,
      borderRadius: 14,
      backgroundColor: native.fill,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    avatarSection: {
      borderRadius: 16,
      backgroundColor: native.fill,
      padding: 18,
      gap: 14,
    },
    appearanceOptions: {
      flexDirection: "row",
      gap: 8,
    },
    appearanceOption: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: native.tertiaryLabel,
      alignItems: "center",
      justifyContent: "center",
    },
    appearanceOptionSelected: {
      borderColor: native.label,
      backgroundColor: native.fillPressed,
    },
    appearanceLabel: {
      color: native.label,
      fontSize: 14,
      fontWeight: "600",
    },
    avatarOptions: {
      flexDirection: "row",
      gap: 12,
    },
    avatarOption: {
      flex: 1,
      minHeight: 86,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: native.tertiaryLabel,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    avatarOptionSelected: {
      borderColor: native.label,
      backgroundColor: native.fillPressed,
    },
    avatarLabel: {
      color: native.label,
      fontSize: 14,
      fontWeight: "600",
    },
    settingsTitle: {
      color: native.label,
      fontSize: 17,
      fontWeight: "600",
    },
    settingsTrailing: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
    },
    settingsValue: {
      color: native.secondaryLabel,
      fontSize: 15,
      marginLeft: "auto",
    },
    chevron: {
      color: native.secondaryLabel,
      fontSize: 28,
      fontWeight: "300",
    },
    appsSection: {
      borderRadius: 16,
      backgroundColor: native.fill,
      padding: 18,
      gap: 12,
    },
    appRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    appName: {
      flex: 1,
      color: native.label,
      fontSize: 16,
    },
    appAction: {
      color: native.label,
      fontSize: 15,
      fontWeight: "600",
    },
    logo: {
      width: 28,
      height: 28,
      borderRadius: 8,
    },
    logoFallback: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: native.fillPressed,
      alignItems: "center",
      justifyContent: "center",
    },
    logoInitial: {
      color: native.secondaryLabel,
      fontSize: 13,
      fontWeight: "700",
    },
    versionCard: {
      borderRadius: 16,
      backgroundColor: native.fill,
      padding: 18,
      alignItems: "center",
      gap: 4,
    },
    versionLine: {
      color: native.tertiaryLabel,
      fontSize: 13,
      textAlign: "center",
    },
    error: {
      color: mobileTokens().destructive,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
