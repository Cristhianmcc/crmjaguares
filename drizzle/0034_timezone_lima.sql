ALTER TABLE "calendar_settings" ALTER COLUMN "timezone" SET DEFAULT 'America/Lima';
UPDATE "calendar_settings" SET "timezone" = 'America/Lima' WHERE "timezone" = 'America/Mexico_City';
