import { Stack } from "expo-router";
import { useI18n } from "../../../lib/i18n";
import { useLargeTitleOptions } from "../../../lib/tab-stack";

export default function ArtifactsStack() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={useLargeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("Artifacts") }} />
    </Stack>
  );
}
