import { randomUUID } from "node:crypto";
import type { AgentRuntime } from "@milo/adapter-kit";
import {
  BOT_INSTRUCTIONS_MAX_LENGTH,
  BOT_TITLE_MAX_LENGTH,
  type RefineBotOutput,
} from "@milo/contracts";

/** Marker the scripted runtime matches so offline tests stay deterministic. */
export const REFINE_PROMPT_MARKER = "milo refine bot profile";

/**
 * One place for the refine prompt. The model returns JSON only:
 * `{"title":"…","instructions":"…"}`.
 */
export function buildRefinePrompt(name: string, description: string): string {
  return `${REFINE_PROMPT_MARKER}
Name: ${name}
Description: ${description || "(none)"}
---
Reply with JSON only, no markdown: {"title":"<short role title>","instructions":"<system instructions for this bot>"}.
Keep title under 80 characters. Instructions should be concrete and actionable.`;
}

export function fallbackRefine(name: string, description: string): RefineBotOutput {
  const trimmed = description.trim();
  const title = (trimmed.split(/[.!\n]/)[0] ?? "").trim().slice(0, 80) || name;
  return {
    title: title.slice(0, BOT_TITLE_MAX_LENGTH),
    instructions: (trimmed || `You are ${name}. Help with whatever is asked.`).slice(
      0,
      BOT_INSTRUCTIONS_MAX_LENGTH,
    ),
  };
}

export function parseRefineReply(
  text: string,
  name: string,
  description: string,
): RefineBotOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallbackRefine(name, description);
  try {
    const parsed = JSON.parse(match[0]) as { title?: unknown; instructions?: unknown };
    const title =
      typeof parsed.title === "string" ? parsed.title.trim().slice(0, BOT_TITLE_MAX_LENGTH) : "";
    const instructions =
      typeof parsed.instructions === "string"
        ? parsed.instructions.trim().slice(0, BOT_INSTRUCTIONS_MAX_LENGTH)
        : "";
    if (!title || !instructions) return fallbackRefine(name, description);
    return { title, instructions };
  } catch {
    return fallbackRefine(name, description);
  }
}

/** Run the refine prompt through the agent runtime and parse the reply. */
export async function refineBotProfile(
  runtime: AgentRuntime,
  input: { name: string; description: string },
  model: { provider: string; id: string },
): Promise<RefineBotOutput> {
  const prompt = buildRefinePrompt(input.name, input.description);
  let text = "";
  for await (const event of runtime.run({
    botId: "refine",
    threadId: "refine",
    runId: randomUUID(),
    prompt,
    instructions: "You refine bot profiles. Reply with JSON only.",
    history: [],
    tools: [],
    model,
  })) {
    if (event.type === "text" && event.text) text += event.text;
    if (event.type === "done" && event.text) text = event.text;
  }
  return parseRefineReply(text, input.name, input.description);
}
