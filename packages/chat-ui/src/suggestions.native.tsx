import { type ColorTokens, darkTokens } from "@milo/ui-tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SuggestionChipsProps } from "./suggestions";

/** A bot's idea chips; picking one sends it as the user's message. */
export function SuggestionChips({
  items,
  onPick,
  disabled,
  palette = darkTokens,
}: SuggestionChipsProps & { palette?: ColorTokens }) {
  return (
    <View style={styles.row} testID="suggestion-chips">
      {items.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(disabled) }}
          disabled={disabled}
          onPress={() => onPick(item)}
          style={({ pressed }) => [
            styles.chip,
            {
              borderColor: palette.border,
              backgroundColor: pressed ? palette.muted : "transparent",
            },
            disabled ? styles.disabled : null,
          ]}
        >
          <Text style={[styles.label, { color: palette.foreground }]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 15 },
  disabled: { opacity: 0.5 },
});
