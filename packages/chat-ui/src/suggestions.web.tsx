import { Button } from "@milo/ui-web";
import type { SuggestionChipsProps } from "./suggestions";

/** A bot's idea chips; picking one sends it as the user's message. */
export function SuggestionChips({ items, onPick, disabled }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="suggestion-chips">
      {items.map((item) => (
        <Button
          key={item}
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={disabled}
          onClick={() => onPick(item)}
          dir="auto"
        >
          {item}
        </Button>
      ))}
    </div>
  );
}
