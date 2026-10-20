import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { BotAvatarShapePicker, cn, GROK_BOT_COLORS } from "@milo/ui-web";

/** Accessible names for the four shapes, in `BOT_AVATAR_SHAPES` order. */
export function botAvatarShapeLabels(): string[] {
  return [t`Circle`, t`Rounded square`, t`Dome`, t`Tile`];
}

export function BotShapeChoices({
  color,
  value,
  onChange,
}: {
  color: string;
  value: number | null;
  onChange: (shapeIndex: number) => void;
}) {
  const { t } = useLingui();
  return (
    <fieldset aria-label={t`Shape`} className="m-0 flex gap-2 border-0 p-0">
      {botAvatarShapeLabels().map((label, shapeIndex) => (
        <BotAvatarShapePicker
          key={label}
          shapeIndex={shapeIndex}
          label={label}
          color={color}
          selected={value === shapeIndex}
          onClick={() => onChange(shapeIndex)}
        />
      ))}
    </fieldset>
  );
}

export function BotColorChoices({
  colors = GROK_BOT_COLORS,
  value,
  onChange,
  className,
}: {
  colors?: readonly string[];
  value: string | null;
  onChange: (color: string) => void;
  className?: string;
}) {
  const { t } = useLingui();
  return (
    <fieldset
      aria-label={t`Color`}
      className={cn("m-0 flex flex-wrap gap-2.5 border-0 p-0", className)}
    >
      {colors.map((color) => {
        const selected = value?.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={t`Color ${color}`}
            aria-pressed={selected}
            className={cn(
              "size-6 rounded-full border transition-transform hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "scale-105 border-transparent ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                : "border-border",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </fieldset>
  );
}
