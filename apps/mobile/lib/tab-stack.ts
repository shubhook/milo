import { useMobileTokens } from "./native";

/** Native large titles on each tab's stack, on the page background. */
export function useLargeTitleOptions() {
  const tokens = useMobileTokens();
  return {
    headerLargeTitle: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerStyle: { backgroundColor: tokens.background },
    headerTintColor: tokens.foreground,
    contentStyle: { backgroundColor: tokens.background },
  };
}
