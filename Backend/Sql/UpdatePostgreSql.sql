-- Called only with the PostgreSQL provider, inside the explicit advisory-lock transaction.
-- Preserve existing category/product IDs, account records and orders.
DO $$
BEGIN
    IF to_regclass('public."Categories"') IS NULL OR to_regclass('public."Products"') IS NULL THEN
        RAISE EXCEPTION 'Expected Categories/Products tables are missing. Check the database/schema before upgrading.';
    END IF;
END $$;

ALTER TABLE public."Categories" ADD COLUMN IF NOT EXISTS "Code" character varying(60) NOT NULL DEFAULT '';
ALTER TABLE public."Categories" ADD COLUMN IF NOT EXISTS "Description" character varying(240) NOT NULL DEFAULT '';
ALTER TABLE public."Categories" ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT TRUE;
UPDATE public."Categories" SET "Code" = 'danh-muc-' || "Id"::text WHERE "Code" = '';
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Categories_Code" ON public."Categories" ("Code");
ALTER TABLE public."Products" ADD COLUMN IF NOT EXISTS "Tag" character varying(30) NOT NULL DEFAULT '';
