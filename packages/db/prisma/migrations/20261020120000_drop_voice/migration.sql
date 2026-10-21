-- Voice is removed from the product. This permanently deletes every stored
-- voice provider key (encrypted secrets of kind 'voice') and voice settings.
DROP TABLE "space_voice_preferences";
DROP TABLE "user_voice_credentials";
DELETE FROM "secrets" WHERE "kind" = 'voice';

ALTER TABLE "bots" DROP COLUMN "voiceId",
DROP COLUMN "autoSpeak";

-- Model keys are now the only account-level secrets.
ALTER TABLE "secrets" DROP CONSTRAINT "secrets_scope_check";
ALTER TABLE "secrets"
  ADD CONSTRAINT "secrets_scope_check"
  CHECK (
    ("kind" = 'model' AND "spaceId" IS NULL)
    OR ("kind" <> 'model' AND "spaceId" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "secrets" VALIDATE CONSTRAINT "secrets_scope_check";
