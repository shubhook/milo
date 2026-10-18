import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import type { ActionApprovalRule, ActionAutoReviewSettings } from "@milo/contracts";
import { Button, Label, Switch } from "@milo/ui-web";
import { useEffect, useId, useState } from "react";
import { rpc } from "../lib/rpc";
import { SegmentedControl } from "./SegmentedControl";

function describeRule(rule: ActionApprovalRule): string {
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
type ApprovalLevel = "act" | "ask";

function asksFirst(rule: ActionApprovalRule, category: ApprovalCategory): boolean {
  return (
    rule.effect === "require_approval" &&
    rule.matchKind === "category" &&
    rule.matchValue === category
  );
}

/**
 * Space-wide approval levels. Bots act by default, so Ask first is a require-approval rule for
 * the category and Act removes it. Narrower rules from "Always allow" are listed below.
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
    if (loading || saving) return;
    const current = rules.filter((rule) => asksFirst(rule, category));
    if ((level === "ask") === current.length > 0) return;
    setSaving(category);
    setError(null);
    try {
      if (level === "ask") {
        const saved = await rpc.approvalRules.set({
          effect: "require_approval",
          matchKind: "category",
          matchValue: category,
        });
        setRules((list) => [...list, saved]);
      } else {
        await Promise.all(current.map((rule) => rpc.approvalRules.remove({ id: rule.id })));
        setRules((list) => list.filter((rule) => !asksFirst(rule, category)));
      }
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
    (rule) => !categories.some((category) => asksFirst(rule, category.id)),
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
            value={rules.some((rule) => asksFirst(rule, category.id)) ? "ask" : "act"}
            onChange={(level) => void setLevel(category.id, level)}
            className={loading || saving === category.id ? "pointer-events-none opacity-60" : ""}
            options={[
              { value: "act", label: t`Act` },
              { value: "ask", label: t`Ask first` },
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
