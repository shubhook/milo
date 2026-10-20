import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useI18n } from "../../lib/i18n";
import { useMobileTokens } from "../../lib/native";
import { useNeedsYouCount } from "../../lib/needs-you";

/** Bots, Routines, Artifacts and Settings. A chat pushes over the tabs and hides the bar. */
export default function TabsLayout() {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const needsYou = useNeedsYouCount();
  return (
    <NativeTabs tintColor={tokens.foreground} badgeBackgroundColor={tokens.destructive}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("Bots")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="forum" />
        <NativeTabs.Trigger.Badge hidden={needsYou === 0}>
          {String(needsYou)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routines">
        <NativeTabs.Trigger.Label>{t("Routines")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="repeat" md="repeat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="artifacts">
        <NativeTabs.Trigger.Label>{t("Artifacts")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder" md="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t("Settings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
