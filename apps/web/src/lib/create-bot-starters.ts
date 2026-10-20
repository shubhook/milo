import { t } from "@lingui/core/macro";

export type CreateBotStarter = {
  id: string;
  label: string;
  name: string;
  title: string;
  description: string;
  shapeIndex: number;
  color: string;
};

/** Client-side presets that fill the Create bot form. Nothing is stored for them. */
export function createBotStarters(): CreateBotStarter[] {
  return [
    {
      id: "inbox",
      label: t`Inbox`,
      name: "Atlas",
      title: t`Inbox`,
      description: t`Triage my email, draft replies and ask before sending.`,
      shapeIndex: 0,
      color: "#3B82F6",
    },
    {
      id: "research",
      label: t`Research`,
      name: "Juno",
      title: t`Research`,
      description: t`Look things up across the web and come back with a short answer and sources.`,
      shapeIndex: 1,
      color: "#F97316",
    },
    {
      id: "design",
      label: t`Design`,
      name: "Pixel",
      title: t`Design`,
      description: t`Make images, slides and mockups from a short brief.`,
      shapeIndex: 2,
      color: "#8B5CF6",
    },
    {
      id: "expenses",
      label: t`Expenses`,
      name: "Ledger",
      title: t`Expenses`,
      description: t`File receipts from Gmail into my expenses sheet every Friday.`,
      shapeIndex: 3,
      color: "#10B981",
    },
  ];
}
