import { Trans, useLingui } from "@lingui/react/macro";
import type { ComputerMode } from "@milo/contracts";
import {
  BOT_DESCRIPTION_MAX_LENGTH,
  BOT_NAME_MAX_LENGTH,
  BOT_TITLE_MAX_LENGTH,
} from "@milo/contracts";
import {
  BotAvatar,
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Input,
  Textarea,
} from "@milo/ui-web";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { BotColorChoices, BotShapeChoices } from "../../components/BotAvatarChoices";
import { SegmentedControl } from "../../components/SegmentedControl";
import { createBotStarters } from "../../lib/create-bot-starters";

export type CreateBotInputDraft = {
  name: string;
  title: string;
  description: string;
  color: string;
  computerMode: ComputerMode;
};

const labelClass = "flex flex-col gap-1.5 text-small font-medium text-muted-foreground";

/**
 * New bot: a live avatar preview beside the form. Starter chips fill the form with
 * client-side presets; nothing about them is stored.
 */
export function CreateBotDialog({
  open,
  onCreate,
  onCancel,
}: {
  open: boolean;
  onCreate: (input: CreateBotInputDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const ids = useId();
  const starters = createBotStarters();
  const [starter, setStarter] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shapeIndex, setShapeIndex] = useState(0);
  const [color, setColor] = useState(starters[0]!.color);
  const [computerMode, setComputerMode] = useState<ComputerMode>("team");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatar = `${color}::shape_${shapeIndex}`;

  async function handleSubmit() {
    if (!name.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        title: title.trim(),
        description: description.trim(),
        color: avatar,
        computerMode,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not create bot`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-3rem)] w-[min(920px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-none md:flex-row"
      >
        <div
          aria-hidden="true"
          className="flex flex-col items-center justify-center gap-3.5 border-b border-border bg-background px-7 py-8 md:w-[340px] md:flex-none md:border-e md:border-b-0 md:py-10"
        >
          <BotAvatar color={avatar} identity="new-bot" size={128} />
          <span className="max-w-full truncate text-center text-[22px] font-semibold text-foreground">
            {name.trim() || t`New bot`}
          </span>
          {title.trim() ? (
            <span className="max-w-full truncate text-center text-muted-foreground">{title}</span>
          ) : null}
        </div>

        <form
          data-testid="create-bot-form"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex items-center ps-7 pe-5 pt-5 pb-1.5">
            <DialogTitle className="flex-1 text-section font-semibold">
              <Trans>New bot</Trans>
            </DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon" aria-label={t`Cancel new bot`} />}
            >
              <X size={18} strokeWidth={1.8} />
            </DialogClose>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-7 pt-2.5 pb-5">
            <div className="flex flex-wrap gap-2">
              {starters.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={starter === item.id}
                  className={cn("h-8 px-3 font-normal", starter === item.id && "border-foreground")}
                  onClick={() => {
                    setStarter(item.id);
                    setName(item.name);
                    setTitle(item.title);
                    setDescription(item.description);
                    setShapeIndex(item.shapeIndex);
                    setColor(item.color);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {error ? (
              <p
                role="alert"
                data-testid="create-bot-error"
                className="text-small text-destructive"
              >
                {error}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label htmlFor={`${ids}-name`} className={labelClass}>
                <Trans>Name</Trans>
                <Input
                  id={`${ids}-name`}
                  value={name}
                  maxLength={BOT_NAME_MAX_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t`Name this bot`}
                />
              </label>
              <label htmlFor={`${ids}-title`} className={labelClass}>
                <Trans>Title</Trans>
                <Input
                  id={`${ids}-title`}
                  value={title}
                  maxLength={BOT_TITLE_MAX_LENGTH}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t`Inbox, Research…`}
                />
              </label>
            </div>
            <label htmlFor={`${ids}-description`} className={labelClass}>
              <Trans>What this bot is for</Trans>
              <Textarea
                id={`${ids}-description`}
                value={description}
                maxLength={BOT_DESCRIPTION_MAX_LENGTH}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t`Describe what this bot does`}
                rows={3}
              />
            </label>

            <div className="flex flex-wrap gap-7">
              <div className="flex flex-col gap-2">
                <span className="text-small font-medium text-muted-foreground">
                  <Trans>Shape</Trans>
                </span>
                <BotShapeChoices color={color} value={shapeIndex} onChange={setShapeIndex} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-small font-medium text-muted-foreground">
                  <Trans>Color</Trans>
                </span>
                <BotColorChoices value={color} onChange={setColor} className="max-w-[260px]" />
              </div>
            </div>

            <div className="flex flex-col gap-2" data-testid="create-bot-computer">
              <span className="text-small font-medium text-muted-foreground">
                <Trans>Computer</Trans>
              </span>
              <SegmentedControl
                label={t`Computer`}
                value={computerMode}
                onChange={setComputerMode}
                options={[
                  { value: "team", label: t`Team`, testId: "create-bot-team" },
                  { value: "dedicated", label: t`Private`, testId: "create-bot-private" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 pt-3.5 pb-[18px]">
            <DialogClose render={<Button type="button" variant="ghost" size="lg" />}>
              <Trans>Cancel</Trans>
            </DialogClose>
            <Button type="submit" size="lg" className="px-4" disabled={!name.trim() || submitting}>
              {submitting ? <Trans>Creating…</Trans> : <Trans>Create</Trans>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
