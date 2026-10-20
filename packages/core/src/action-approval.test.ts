import { describe, expect, it } from "vitest";
import {
  type ActionApprovalRule,
  applyJudgeDecision,
  connectorKindFromToolName,
  connectorToolRequiresApproval,
  isApprovalAskBlock,
  isSecretAskBlock,
  planActionGate,
  resolveActionApproval,
  resolveActionApprovalDetail,
  toolRequiresApproval,
  toolRequiresExplicitApproval,
  unattendedTriggerToolRequiresApproval,
} from "./action-approval.js";

describe("toolRequiresApproval", () => {
  it("requires approval for consequential builtins and destination writes", () => {
    expect(toolRequiresApproval("destination.write", false)).toBe(true);
    expect(toolRequiresApproval("destination.write", true)).toBe(true);
    expect(toolRequiresApproval("secret_request", false)).toBe(true);
    expect(toolRequiresApproval("forget_secret", false)).toBe(true);
    expect(toolRequiresApproval("list_secrets", false)).toBe(false);
    expect(toolRequiresApproval("delete_bot", false)).toBe(true);
    expect(toolRequiresApproval("archive_bot", false)).toBe(true);
    expect(toolRequiresApproval("create_space", false)).toBe(true);
    expect(toolRequiresExplicitApproval("create_space")).toBe(true);
    expect(toolRequiresExplicitApproval("save_shared_memory")).toBe(false);
    expect(toolRequiresExplicitApproval("archive_bot")).toBe(false);
  });

  it("does not gate read-only or local work", () => {
    for (const name of [
      "list_files",
      "computer_observe",
      "read_file",
      "write_file",
      "shell",
      "remember",
      "save_shared_memory",
      "spawn_bot",
      "run_subagent",
    ]) {
      expect(toolRequiresApproval(name, false)).toBe(false);
    }
  });

  it("gates connector executes except obvious reads", () => {
    expect(toolRequiresApproval("gmail_send_email", true)).toBe(true);
    expect(toolRequiresApproval("crm_create_note", true)).toBe(true);
    expect(toolRequiresApproval("get_contact", true)).toBe(false);
    expect(toolRequiresApproval("contacts_get", true)).toBe(false);
    expect(toolRequiresApproval("GMAIL_LIST_THREADS", true)).toBe(false);
    expect(toolRequiresApproval("list_messages", true)).toBe(false);
    expect(toolRequiresApproval("search_threads", true)).toBe(false);
    expect(toolRequiresApproval("find_user", true)).toBe(false);
    expect(toolRequiresApproval("read_inbox", true)).toBe(false);
    expect(toolRequiresApproval("contacts_get_or_create", true)).toBe(true);
    expect(toolRequiresApproval("notion_search_and_update", true)).toBe(true);
    expect(toolRequiresApproval("crm_get_then_upsert", true)).toBe(true);
  });
});

describe("connectorToolRequiresApproval", () => {
  it("matches read-only connector tool names", () => {
    expect(connectorToolRequiresApproval("list_items")).toBe(false);
    expect(connectorToolRequiresApproval("send_message")).toBe(true);
  });

  it("requires approval for a declared write whatever its name says", () => {
    expect(connectorToolRequiresApproval("read_profile_card", false)).toBe(true);
    expect(connectorToolRequiresApproval("find_validator_record", false)).toBe(true);
    expect(connectorToolRequiresApproval("read_profile_card", true)).toBe(false);
    expect(connectorToolRequiresApproval("read_profile_card")).toBe(false);
  });

  it("never lets a declared read relax a mutating or ambiguous name", () => {
    expect(connectorToolRequiresApproval("delete_item", true)).toBe(true);
    expect(connectorToolRequiresApproval("get_or_create_contact", true)).toBe(true);
    expect(connectorToolRequiresApproval("profile_card", true)).toBe(true);
  });
});

describe("resolveActionApprovalDetail", () => {
  it("applies category rules to declared writes with read-looking names", () => {
    const rules = [
      { effect: "require_approval" as const, matchKind: "category" as const, matchValue: "email" },
    ];
    const base = { toolName: "gmail_read_thread", connectorKind: "gmail", rules };
    expect(resolveActionApprovalDetail(base).decision).toBe("allow");
    expect(resolveActionApprovalDetail({ ...base, readOnly: false }).decision).toBe("ask");
  });

  it("hands off ahead of asking or allowing at the same specificity", () => {
    const toolName = "gmail_send_email";
    const rule = (effect: "always_allow" | "require_approval" | "hand_off") => ({
      effect,
      matchKind: "category" as const,
      matchValue: "email",
    });
    const handed = resolveActionApprovalDetail({
      toolName,
      connectorKind: "gmail",
      rules: [rule("always_allow"), rule("require_approval"), rule("hand_off")],
    });
    expect(handed).toMatchObject({ decision: "hand", source: "hand_off" });
    // A narrower allow still wins over a category hand-off, as with Ask first.
    expect(
      resolveActionApprovalDetail({
        toolName,
        connectorKind: "gmail",
        rules: [
          rule("hand_off"),
          { effect: "always_allow", matchKind: "tool", matchValue: toolName },
        ],
      }).decision,
    ).toBe("allow");
  });
});

describe("unattendedTriggerToolRequiresApproval", () => {
  it("forces approval for webhook-triggered local side effects", () => {
    for (const name of ["shell", "write_file", "browser_act", "computer_act"]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(true);
    }
  });

  it("allows webhook-triggered reads to stay unattended", () => {
    for (const name of [
      "computer_observe",
      "read_file",
      "web_search",
      "browser_snapshot",
      "request_takeover",
      "run_subagent",
    ]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, false)).toBe(false);
    }
    expect(unattendedTriggerToolRequiresApproval("webhook", "github_get_issue", true)).toBe(false);
  });

  it("forces approval for webhook-triggered connector writes regardless of normal rules", () => {
    expect(unattendedTriggerToolRequiresApproval("webhook", "github_create_issue", true)).toBe(
      true,
    );
    expect(unattendedTriggerToolRequiresApproval("user", "shell", false)).toBe(false);
  });

  it("forces approval for webhook-triggered declared writes with read-looking names", () => {
    for (const name of ["read_profile_card", "find_validator_record", "get_status"]) {
      expect(unattendedTriggerToolRequiresApproval("webhook", name, true, false)).toBe(true);
      expect(toolRequiresApproval(name, true, false)).toBe(true);
    }
    expect(unattendedTriggerToolRequiresApproval("webhook", "read_profile_card", true, true)).toBe(
      false,
    );
    expect(unattendedTriggerToolRequiresApproval("webhook", "delete_record", true, true)).toBe(
      true,
    );
    expect(unattendedTriggerToolRequiresApproval("user", "read_profile_card", true, false)).toBe(
      false,
    );
  });
});

describe("isApprovalAskBlock", () => {
  it("detects allow/deny approval cards", () => {
    expect(
      isApprovalAskBlock({
        kind: "ask",
        approvalEffectId: "effect-1",
        actions: [
          { id: "allow", label: "Allow once" },
          { id: "always", label: "Always allow" },
          { id: "deny", label: "Deny" },
        ],
      }),
    ).toBe(true);
    expect(isApprovalAskBlock({ kind: "ask" })).toBe(false);
    expect(
      isApprovalAskBlock({
        kind: "ask",
        approvalEffectId: "effect-1",
        actions: [{ id: "deny", label: "No" }],
      }),
    ).toBe(false);
  });
});

describe("isSecretAskBlock", () => {
  it("detects masked secret asks", () => {
    expect(isSecretAskBlock({ kind: "ask", input: "secret" })).toBe(true);
    expect(isSecretAskBlock({ kind: "ask", input: "text" })).toBe(false);
    expect(
      isSecretAskBlock({
        kind: "ask",
        input: "secret",
        approvalEffectId: "effect-1",
      }),
    ).toBe(false);
  });
});

describe("connectorKindFromToolName", () => {
  it("uses the first underscore segment", () => {
    expect(connectorKindFromToolName("gmail_send_email")).toBe("gmail");
  });

  it("prefers the longest matching connected provider slug", () => {
    expect(
      connectorKindFromToolName("microsoft_outlook_send_email", ["microsoft", "microsoft_outlook"]),
    ).toBe("microsoft_outlook");
  });
});

describe("resolveActionApproval", () => {
  const alwaysAllowDestination: ActionApprovalRule[] = [
    { effect: "always_allow", matchKind: "tool", matchValue: "destination.write" },
  ];
  const requireEmail: ActionApprovalRule[] = [
    { effect: "require_approval", matchKind: "category", matchValue: "email" },
  ];
  const requireDestination: ActionApprovalRule[] = [
    { effect: "require_approval", matchKind: "tool", matchValue: "destination.write" },
  ];

  it("skips approval when always-allow matches", () => {
    expect(
      resolveActionApproval({
        toolName: "destination.write",
        rules: alwaysAllowDestination,
      }),
    ).toBe("allow");
  });

  it("requires approval for email even when always-allow would match another tool", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_send_email",
        rules: [...alwaysAllowDestination, ...requireEmail],
      }),
    ).toBe("ask");
  });

  it("does not apply consequential categories to connector reads", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_list_threads",
        rules: requireEmail,
      }),
    ).toBe("allow");
  });

  it("lets an explicit rule gate a tool that is exempt by default", () => {
    expect(
      resolveActionApproval({
        toolName: "shell",
        rules: [{ effect: "require_approval", matchKind: "tool", matchValue: "shell" }],
      }),
    ).toBe("ask");
  });

  it("lets require_approval beat always-allow at the same specificity", () => {
    expect(
      resolveActionApproval({
        toolName: "destination.write",
        rules: [...alwaysAllowDestination, ...requireDestination],
      }),
    ).toBe("ask");
  });

  it("allows actions by default when no rules match", () => {
    expect(
      resolveActionApproval({
        toolName: "list_files",
        rules: [],
      }),
    ).toBe("allow");
    expect(
      resolveActionApproval({
        toolName: "destination.write",
        rules: [],
      }),
    ).toBe("allow");
  });

  it("lets a tool exception override a broader category rule", () => {
    expect(
      resolveActionApproval({
        toolName: "gmail_send_email",
        rules: [
          ...requireEmail,
          { effect: "always_allow", matchKind: "tool", matchValue: "gmail_send_email" },
        ],
      }),
    ).toBe("allow");
  });

  it("labels always-allow vs default allow", () => {
    expect(
      resolveActionApprovalDetail({
        toolName: "destination.write",
        rules: alwaysAllowDestination,
      }),
    ).toMatchObject({ decision: "allow", source: "always_allow" });
    expect(
      resolveActionApprovalDetail({
        toolName: "destination.write",
        rules: [],
      }),
    ).toMatchObject({ decision: "allow", source: "default" });
  });
});

describe("planActionGate", () => {
  const consequential = true;
  const alwaysAllow = {
    decision: "allow" as const,
    source: "always_allow" as const,
    matchingRules: [
      { effect: "always_allow" as const, matchKind: "connector" as const, matchValue: "gmail" },
    ],
  };

  it("hands off before asking or judging", () => {
    expect(
      planActionGate({
        resolved: { decision: "hand", source: "hand_off", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("hand");
  });

  it("lets require_approval win without judging", () => {
    expect(
      planActionGate({
        resolved: {
          decision: "ask",
          source: "require_approval",
          matchingRules: [],
        },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("ask");
  });

  it("judges consequential always_allow matches when auto review is ready", () => {
    expect(
      planActionGate({
        resolved: alwaysAllow,
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("judge");
  });

  it("lets always_allow run when auto review is off or checker missing", () => {
    expect(
      planActionGate({
        resolved: alwaysAllow,
        consequential,
        autoReviewEnabled: false,
        checkerConfigured: true,
      }),
    ).toBe("allow");
    expect(
      planActionGate({
        resolved: alwaysAllow,
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: false,
      }),
    ).toBe("allow");
  });

  it("lets non-consequential always_allow matches run without judging", () => {
    expect(
      planActionGate({
        resolved: alwaysAllow,
        consequential: false,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("allow");
  });

  it("judges consequential default actions when auto review is ready", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("judge");
  });

  it("stays YOLO when auto review is off or checker missing", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: false,
        checkerConfigured: true,
      }),
    ).toBe("allow");
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential,
        autoReviewEnabled: true,
        checkerConfigured: false,
      }),
    ).toBe("allow");
  });

  it("does not judge non-consequential tools", () => {
    expect(
      planActionGate({
        resolved: { decision: "allow", source: "default", matchingRules: [] },
        consequential: false,
        autoReviewEnabled: true,
        checkerConfigured: true,
      }),
    ).toBe("allow");
  });
});

describe("applyJudgeDecision", () => {
  it("maps pass and ask", () => {
    expect(applyJudgeDecision({ decision: "pass", consequential: true })).toBe("allow");
    expect(applyJudgeDecision({ decision: "ask", consequential: true })).toBe("ask");
  });

  it("fails closed on consequential checker errors and open on exempt", () => {
    expect(applyJudgeDecision({ decision: "error", consequential: true })).toBe("ask");
    expect(applyJudgeDecision({ decision: "error", consequential: false })).toBe("allow");
  });
});
