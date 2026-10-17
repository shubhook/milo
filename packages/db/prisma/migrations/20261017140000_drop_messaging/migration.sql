-- Chat-platform messaging (Slack, Telegram, WhatsApp, Lark, Sendblue), its team-chat rooms and
-- cross-Space agent connections were removed. Keep what people wrote, drop what only it used.

-- Group-chat posts in a bot's own thread become plain text so the history still reads and parses.
UPDATE "messages"
SET "blocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN block->>'kind' = 'channel_message'
        THEN jsonb_build_object(
          'kind', 'text',
          'text', COALESCE(block->>'fromLabel', '') || ': ' || COALESCE(block->>'text', '')
        )
      ELSE block
    END
    ORDER BY position
  )
  FROM jsonb_array_elements("blocks") WITH ORDINALITY AS item(block, position)
)
WHERE jsonb_typeof("blocks") = 'array'
  AND "blocks" @> '[{"kind": "channel_message"}]'::jsonb;

UPDATE "events"
SET "payload" = jsonb_set(
  "payload",
  '{blocks}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN block->>'kind' = 'channel_message'
          THEN jsonb_build_object(
            'kind', 'text',
            'text', COALESCE(block->>'fromLabel', '') || ': ' || COALESCE(block->>'text', '')
          )
        ELSE block
      END
      ORDER BY position
    )
    FROM jsonb_array_elements("payload"->'blocks') WITH ORDINALITY AS item(block, position)
  )
)
WHERE jsonb_typeof("payload"->'blocks') = 'array'
  AND "payload"->'blocks' @> '[{"kind": "channel_message"}]'::jsonb;

-- Chat-started turns continue as ordinary follow-ups.
UPDATE "runs" SET "trigger" = 'follow_up' WHERE "trigger" = 'messaging';

-- A routine whose only trigger was an incoming chat message can no longer fire.
UPDATE "routines"
SET "active" = false
WHERE "messageProvider" IS NOT NULL
  AND cardinality("crons") = 0
  AND NOT "webhookEnabled"
  AND NOT "githubEnabled";

-- Team-chat rooms had their own threads; deleting the rooms cascades to those threads.
DELETE FROM "external_conversations";

ALTER TABLE "threads" DROP COLUMN "externalConversationId";
ALTER TABLE "bots" DROP COLUMN "teamChatAmbientEnabled", DROP COLUMN "teamChatRules";
ALTER TABLE "runs" DROP COLUMN "messagingMirroredAt", DROP COLUMN "teamChatMirroredAt";
ALTER TABLE "routines" DROP COLUMN "messageProvider";
ALTER TABLE "steering_messages" DROP COLUMN "originTrigger";

DROP TABLE "external_messages";
DROP TABLE "external_conversations";
DROP TABLE "agent_connections";
DROP TABLE "messaging_outbound";
DROP TABLE "messaging_link_codes";
DROP TABLE "messaging_channel_members";
DROP TABLE "messaging_channels";
DROP TABLE "messaging_identities";
