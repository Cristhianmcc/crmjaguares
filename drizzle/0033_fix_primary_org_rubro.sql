UPDATE "organization"
SET "rubro" = 'escuela'
WHERE "id" = (
  SELECT "id" FROM "organization" ORDER BY "created_at" ASC LIMIT 1
);
