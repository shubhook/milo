-- Cloud coding agents (Cursor) were removed. Drop their table and the history that only they
-- could render, so stored threads and runs still parse against the current contracts.
DROP TABLE "cloud_agents";

DELETE FROM "events" WHERE "type" = 'thread.cloud_agent';

UPDATE "messages"
SET "blocks" = COALESCE(
  (
    SELECT jsonb_agg(block ORDER BY position)
    FROM jsonb_array_elements("blocks") WITH ORDINALITY AS item(block, position)
    WHERE block->>'kind' IS DISTINCT FROM 'cloud_agent'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("blocks") = 'array'
  AND "blocks" @> '[{"kind": "cloud_agent"}]'::jsonb;

-- Runs a finished cloud agent woke keep their history under the generic resume trigger.
UPDATE "runs" SET "trigger" = 'resume' WHERE "trigger" = 'cloud_agent';
