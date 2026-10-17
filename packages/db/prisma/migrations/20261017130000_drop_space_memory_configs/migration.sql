-- Serenity and Supermemory were the only semantic memory providers. Remove each Space's
-- connection, the encrypted credential it referenced, and the per-bot scope only they read.
DELETE FROM "secrets" WHERE "id" IN (SELECT "secretId" FROM "space_memory_configs");

DROP TABLE "space_memory_configs";

ALTER TABLE "bots" DROP COLUMN "memoryScope";
