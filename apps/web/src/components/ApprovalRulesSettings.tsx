import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ActionApprovalRule, ActionAutoReviewSettings } from "@milo/contracts";
import { Button, Label, Switch } from "@milo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { SegmentedControl } from "./SegmentedControl";

function describeRule(rule: ActionApprovalRule): string {
  // The settings rows cover category hand-offs; others come only from the API.
  if (rule.effect === "hand_off") return t`Hand ${rule.matchValue} to me`;
  if (rule.effect === "require_approval") {
    if (rule.matchKind === "category") {
      if (rule.matchValue === "email") return t`Ask before email actions`;
      if (rule.matchValue === "purchase") return t`Ask before purchase actions`;
      return t`Ask before ${rule.matchValue} actions`;
    }
    if (rule.matchKind === "connector") return t`Ask before ${rule.matchValue} connector`;
    return t`Ask before ${rule.matchValue}`;
  }
  if (rule.matchKind === "category") {
    if (rule.matchValue === "email") return t`Allow email actions without asking`;
    if (rule.matchValue === "purchase") return t`Allow purchase actions without asking`;
    return t`Allow ${rule.matchValue} actions without asking`;
  }
  if (rule.matchKind === "connector") return t`Allow ${rule.matchValue} connector without asking`;
  return t`Allow ${rule.matchValue} without asking`;
}

type ApprovalCategory = "email" | "purchase";
type ApprovalLevel = "act" | "ask" | "hand";

const LEVEL_EFFECTS = { ask: "require_approval", hand: "hand_off" } as const;

/** A category rule that sets a level above Act: Ask first or Hand to me. */
function levelRule(rule: ActionApprovalRule, category: ApprovalCategory): boolean {
  return (
    (rule.effect === "require_approval" || rule.effect === "hand_off") &&
    rule.matchKind === "category" &&
    rule.matchValue === category
  );
}

function categoryLevel(rules: ActionApprovalRule[], category: ApprovalCategory): ApprovalLevel {
  const set = rules.filter((rule) => levelRule(rule, category));
  if (set.some((rule) => rule.effect === "hand_off")) return "hand";
  return set.length > 0 ? "ask" : "act";
}

/**
 * Space-wide approval levels. Bots act by default, so Ask first is a require-approval rule for
 * the category, Hand to me a hand-off rule, and Act removes both. Narrower rules from
 * "Always allow" are listed below.
 */
export function ApprovalRulesSettings() {
  const { t } = useLingui();
  const autoReviewId = useId();
  const [rules, setRules] = useState<ActionApprovalRule[]>([]);
  const [autoReview, setAutoReview] = useState<ActionAutoReviewSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ApprovalCategory | null>(null);
  const [savingAutoReview, setSavingAutoReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextRules, nextAutoReview] = await Promise.all([
        rpc.approvalRules.list(),
        rpc.autoReview.get(),
      ]);
      setRules(nextRules);
      setAutoReview(nextAutoReview);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not load approval rules`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function setLevel(category: ApprovalCategory, level: ApprovalLevel) {
    if (loading || saving || categoryLevel(rules, category) === level) return;
    const current = rules.filter((rule) => levelRule(rule, category));
    setSaving(category);
    setError(null);
    try {
      await Promise.all(current.map((rule) => rpc.approvalRules.remove({ id: rule.id })));
      const saved =
        level === "act"
          ? null
          : await rpc.approvalRules.set({
              effect: LEVEL_EFFECTS[level],
              matchKind: "category",
              matchValue: category,
            });
      setRules((list) => [
        ...list.filter((rule) => !levelRule(rule, category)),
        ...(saved ? [saved] : []),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not save rule`);
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  async function removeRule(id: string) {
    setError(null);
    try {
      await rpc.approvalRules.remove({ id });
      setRules((current) => current.filter((rule) => rule.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not remove rule`);
    }
  }

  async function toggleAutoReview(enabled: boolean) {
    if (loading || savingAutoReview) return;
    setSavingAutoReview(true);
    setError(null);
    try {
      setAutoReview(await rpc.autoReview.set({ enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Could not save Auto Review`);
    } finally {
      setSavingAutoReview(false);
    }
  }

  const categories: { id: ApprovalCategory; label: string }[] = [
    { id: "email", label: t`Email` },
    { id: "purchase", label: t`Purchases` },
  ];
  const otherRules = rules.filter(
    (rule) => !categories.some((category) => levelRule(rule, category.id)),
  );

  return (
    <div data-testid="action-confirmation-settings">
      {categories.map((category) => (
        <div
          key={category.id}
          className="flex flex-wrap items-center gap-4 border-b border-border py-3"
        >
          <span className="min-w-[180px] flex-1 font-medium">{category.label}</span>
          <SegmentedControl
            label={category.label}
            value={categoryLevel(rules, category.id)}
            onChange={(level) => void setLevel(category.id, level)}
            className={loading || saving === category.id ? "pointer-events-none opacity-60" : ""}
            options={[
              { value: "act", label: t`Act` },
              { value: "ask", label: t`Ask first` },
              // Hand to me stays visible only for a category already set to it.
              ...(categoryLevel(rules, category.id) === "hand"
                ? [{ value: "hand" as const, label: t`Hand to me` }]
                : []),
            ]}
          />
        </div>
      ))}
      <div className="flex items-center gap-4 border-b border-border py-3">
        <div className="flex-1">
          <Label htmlFor={autoReviewId} className="text-body font-medium">
            <Trans>Flag unexpected actions</Trans>
          </Label>
          {autoReview?.enabled && !autoReview.checkerAvailable ? (
            <p className="mt-1 text-small text-muted-foreground">
              <Trans>Add a model in Settings to use this.</Trans>
            </p>
          ) : null}
        </div>
        <Switch
          id={autoReviewId}
          data-testid="auto-review-toggle"
          checked={autoReview?.enabled ?? false}
          disabled={loading || savingAutoReview || !autoReview}
          onCheckedChange={(checked) => void toggleAutoReview(checked)}
        />
      </div>
      {error ? <p className="mt-3 text-small text-destructive">{error}</p> : null}
      {otherRules.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {otherRules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5"
            >
              <span className="text-muted-foreground">{describeRule(rule)}</span>
              <Button variant="ghost" onClick={() => void removeRule(rule.id)}>
                <Trans>Remove</Trans>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
