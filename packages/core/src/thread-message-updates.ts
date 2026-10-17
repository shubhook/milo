/** Remove this run's live message and obsolete unscoped progress without reordering history. */
export function takeLiveMessage<Message extends { id: string; runId?: string | null }>(
  messages: readonly Message[],
  liveId: string,
): { previous: Message | undefined; remaining: Message[] } {
  let previous: Message | undefined;
  const remaining: Message[] = [];
  for (const message of messages) {
    if (message.id === liveId) previous = message;
    else if (!message.id.startsWith("progress:") || message.runId) remaining.push(message);
  }
  return { previous, remaining };
}
