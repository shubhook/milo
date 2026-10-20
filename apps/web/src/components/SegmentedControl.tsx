import { cn, Toggle } from "@milo/ui-web";
import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown instead of the label, which then names the option for assistive tech. */
  icon?: ReactNode;
  testId?: string;
};

/** One choice out of a few, as pills on a muted track. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className={cn(
        "m-0 inline-flex w-fit gap-0.5 rounded-full border-0 bg-muted p-[3px]",
        className,
      )}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          size="sm"
          pressed={value === option.value}
          data-testid={option.testId}
          aria-label={option.icon ? option.label : undefined}
          title={option.icon ? option.label : undefined}
          onPressedChange={(pressed) => {
            if (pressed) onChange(option.value);
          }}
          className="h-7 rounded-full px-3 text-small font-normal text-muted-foreground hover:bg-transparent aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-raised"
        >
          {option.icon ?? option.label}
        </Toggle>
      ))}
    </fieldset>
  );
}
