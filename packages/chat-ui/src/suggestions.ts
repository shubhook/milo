export type SuggestionChipsProps = {
  items: string[];
  onPick: (item: string) => void;
  disabled?: boolean;
};
