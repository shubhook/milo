import { describe, expect, it } from "vitest";
import { ChatGptSignInEmulator } from "./chatgpt-sign-in-emulator.js";

describe("ChatGptSignInEmulator", () => {
  it("stays pending until a test approves the flow, then connects once", async () => {
    const emulator = new ChatGptSignInEmulator();
    const { flowId, url } = await emulator.start();
    expect(new URL(url).searchParams.get("state")).toBe(flowId);
    expect(await emulator.complete(flowId)).toEqual({ status: "pending" });

    expect(emulator.approve(flowId, { email: "Ada@Example.test", name: "Ada" })).toBe(true);
    expect(await emulator.complete(flowId)).toEqual({
      status: "connected",
      clientId: "emulated-client",
      identity: {
        subject: "emulated:ada@example.test",
        email: "ada@example.test",
        emailVerified: true,
        name: "Ada",
      },
    });
    expect(await emulator.complete(flowId)).toMatchObject({ status: "error" });
  });

  it("refuses to approve an unknown flow", () => {
    expect(new ChatGptSignInEmulator().approve("missing", { email: "a@example.test" })).toBe(false);
  });
});
