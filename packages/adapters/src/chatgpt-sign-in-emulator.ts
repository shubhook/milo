import { randomBytes } from "node:crypto";
import type { ChatGptCallback, ChatGptIdentity, ChatGptSignInResult } from "./chatgpt-plan.js";

/** The flow surface the auth endpoints use, shared by `ChatGptSignIn` and the emulator. */
export interface ChatGptSignInFlow {
  start(input: { clientId?: string; listen: boolean }): Promise<{ flowId: string; url: string }>;
  complete(flowId: string, callback?: ChatGptCallback): Promise<ChatGptSignInResult>;
  cancelAll(): void;
}

export const CHATGPT_EMULATOR_AUTHORIZE_URL = "https://chatgpt.example.test/authorize";
const EMULATOR_CLIENT_ID = "emulated-client";

/**
 * Deterministic, offline Sign in with ChatGPT for tests. The authorize URL never
 * loads; a test approves the flow named by its `state` with the identity to sign in as.
 */
export class ChatGptSignInEmulator implements ChatGptSignInFlow {
  private readonly flows = new Map<string, ChatGptIdentity | null>();

  async start(): Promise<{ flowId: string; url: string }> {
    const flowId = randomBytes(16).toString("base64url");
    this.flows.set(flowId, null);
    const url = new URL(CHATGPT_EMULATOR_AUTHORIZE_URL);
    url.searchParams.set("state", flowId);
    return { flowId, url: url.href };
  }

  /** Finishes the flow as this ChatGPT account. The subject follows the email, so it signs in again. */
  approve(flowId: string, account: { email: string; name?: string }): boolean {
    if (!this.flows.has(flowId)) return false;
    const email = account.email.trim().toLowerCase();
    this.flows.set(flowId, {
      subject: `emulated:${email}`,
      email,
      emailVerified: true,
      ...(account.name ? { name: account.name } : {}),
    });
    return true;
  }

  async complete(flowId: string): Promise<ChatGptSignInResult> {
    if (!this.flows.has(flowId)) {
      return { status: "error", error: "This sign-in expired. Start again." };
    }
    const identity = this.flows.get(flowId);
    if (!identity) return { status: "pending" };
    this.flows.delete(flowId);
    return { status: "connected", identity, clientId: EMULATOR_CLIENT_ID };
  }

  cancelAll(): void {
    this.flows.clear();
  }
}
