import type { AvatarStyle } from "@milo/contracts";
import { parseBotAvatarValue } from "@milo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  avatarIdentitySeed,
  botAvatarEyes,
  botAvatarShape,
  botAvatarShapeIndexForIdentity,
  botAvatarStatusTone,
  organicAvatarPath,
  resolvePersonaColorDef,
} from "@milo/core";
import { memo, useEffect } from "react";
import { Image, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { G, Path, Rect } from "react-native-svg";
import { workingAvatarDuration, workingAvatarFrame } from "../lib/avatar-motion";
import { useI18n } from "../lib/i18n";
import { useMobileTokens } from "../lib/native";
import { useAvatarStyle } from "./avatar-style";
import { NativeSymbol } from "./native-symbol";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 54,
  status,
  unread = false,
  identity,
  variant,
  muted = false,
}: {
  color: string;
  size?: number;
  status?: string;
  unread?: boolean;
  identity?: string;
  variant?: AvatarStyle;
  muted?: boolean;
}) {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const isWorking = ACTIVE_RUN_STATUSES.some((activeStatus) => activeStatus === status);
  const { avatarStyle } = useAvatarStyle();
  const parsed = parseBotAvatarValue(color);
  const fillColor = parsed.kind === "shape" || parsed.kind === "color" ? parsed.color : color;
  const tone = botAvatarStatusTone(status);
  const picture =
    parsed.kind === "image" && parsed.imageUrl ? (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        }}
      >
        <Image source={{ uri: parsed.imageUrl }} style={{ width: size, height: size }} />
      </View>
    ) : parsed.kind !== "shape" && (variant ?? avatarStyle) === "organic" ? (
      <OrganicAvatar color={fillColor} identity={identity} size={size} isWorking={isWorking} />
    ) : (
      <ShapeAvatar
        color={fillColor}
        shapeIndex={
          parsed.kind === "shape"
            ? parsed.shapeIndex
            : botAvatarShapeIndexForIdentity(identity || fillColor || "agent")
        }
        size={size}
      />
    );
  const dotSize = Math.max(10, Math.round(size * 0.26));
  return (
    <View style={{ width: size, height: size }}>
      {picture}
      {(tone || unread) && !muted ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize,
            borderWidth: 2.5,
            borderColor: tokens.background,
            backgroundColor:
              tone === "warning"
                ? tokens.warning
                : tone === "destructive"
                  ? tokens.destructive
                  : tokens.foreground,
          }}
        />
      ) : null}
      {muted ? (
        <View
          accessible
          accessibilityLabel={t("Notifications silenced")}
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: Math.max(14, Math.round(size * 0.34)),
            height: Math.max(14, Math.round(size * 0.34)),
            borderRadius: size,
            borderWidth: 2,
            borderColor: tokens.background,
            backgroundColor: tokens.secondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol
            ios="bell.slash.fill"
            android="notifications-off"
            size={Math.max(8, Math.round(size * 0.17))}
            color={tokens.secondaryForeground}
          />
        </View>
      ) : null}
    </View>
  );
});

function ShapeAvatar({
  color,
  shapeIndex,
  size,
}: {
  color: string;
  shapeIndex: number;
  size: number;
}) {
  const [topLeft, topRight, bottomRight, bottomLeft] = botAvatarShape(shapeIndex).corners;
  const eyes = botAvatarEyes(size);
  const colorDef = resolvePersonaColorDef("preview", color);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderTopLeftRadius: topLeft * size,
        borderTopRightRadius: topRight * size,
        borderBottomRightRadius: bottomRight * size,
        borderBottomLeftRadius: bottomLeft * size,
        backgroundColor: colorDef.hex,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: eyes.gap,
      }}
    >
      {[0, 1].map((eye) => (
        <View
          key={eye}
          style={{
            width: eyes.width,
            height: eyes.height,
            borderRadius: eyes.radius,
            backgroundColor: colorDef.eyeColor,
          }}
        />
      ))}
    </View>
  );
}

function OrganicAvatar({
  color,
  identity,
  size,
  isWorking,
}: {
  color: string;
  identity?: string;
  size: number;
  isWorking: boolean;
}) {
  const seed = avatarIdentitySeed(identity || color || "#8B5CF6");
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (isWorking && !reducedMotion) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: workingAvatarDuration(seed),
          easing: Easing.linear,
        }),
        -1,
      );
    }
    return () => cancelAnimation(progress);
  }, [isWorking, progress, reducedMotion, seed]);

  const bodyStyle = useAnimatedStyle(() => {
    const frame = workingAvatarFrame(seed, progress.value);
    return {
      transform: [
        { translateX: (frame.translationX * size) / 120 },
        { translateY: (frame.translationY * size) / 120 },
        { rotate: `${frame.rotation}deg` },
        { scaleX: frame.scaleX },
        { scaleY: frame.scaleY },
      ],
    };
  });
  const leftEyeProps = useAnimatedProps(() => {
    const frame = workingAvatarFrame(seed, progress.value);
    return { x: -14 + frame.eyeOffsetX, y: -12 + frame.eyeOffsetY };
  });
  const rightEyeProps = useAnimatedProps(() => {
    const frame = workingAvatarFrame(seed, progress.value);
    return { x: 7 + frame.eyeOffsetX, y: -12 + frame.eyeOffsetY };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
        <Svg width={size} height={size} viewBox="-60 -60 120 120">
          <Path d={organicAvatarPath(seed)} fill={color} />
          <G transform={`rotate(${(seed % 9) - 4})`}>
            <AnimatedRect
              animatedProps={leftEyeProps}
              width={7}
              height={24}
              rx={3.5}
              fill="#101014"
            />
            <AnimatedRect
              animatedProps={rightEyeProps}
              width={7}
              height={24}
              rx={3.5}
              fill="#101014"
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
