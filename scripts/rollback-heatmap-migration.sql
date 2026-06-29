-- Manual rollback for prisma/migrations/20_add_heatmap/migration.sql
-- Run this only if you roll back the app/code to a commit before the
-- "add_heatmap" migration and need the DB schema to match again.
--
-- Usage: psql "$DATABASE_URL" -f scripts/rollback-heatmap-migration.sql

ALTER TABLE "website" RENAME COLUMN "recorder_enabled" TO "replay_enabled";

DROP TABLE IF EXISTS "heatmap_event";

-- Also remove the migration's row from Prisma's tracking table so a future
-- `prisma migrate deploy` will re-apply it cleanly instead of thinking it's
-- already applied against a schema that no longer matches.
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20_add_heatmap';
