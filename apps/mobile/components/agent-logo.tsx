import type { AgentLogo as AgentLogoName } from "@milo/core";
import { AGENT_LOGOS } from "@milo/core";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useMobileTokens } from "../lib/native";

/** The agent's mark on a bordered tile, as on the web model rows. */
export function AgentLogo({ agent, size = 36 }: { agent: AgentLogoName; size?: number }) {
  const tokens = useMobileTokens();
  const logo = AGENT_LOGOS[agent];
  const mark = Math.round(size * 0.55);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={mark} height={mark} viewBox="0 0 24 24">
        <Path d={logo.path} fill={logo.fill ?? tokens.foreground} />
      </Svg>
    </View>
  );
}
