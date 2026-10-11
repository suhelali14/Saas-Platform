-- Phase 9: regional language support for the public clinic website.
-- Hand-written and applied with `prisma migrate deploy`.

ALTER TABLE "Clinic" ADD COLUMN "defaultLocale" TEXT DEFAULT 'en';
ALTER TABLE "Clinic" ADD COLUMN "enabledLocales" JSONB;

CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    -- "" rather than NULL for clinic-level fields: Postgres treats NULLs as
    -- distinct in a unique index, so a nullable column here would silently
    -- permit duplicate rows for the same field.
    "entityId" TEXT NOT NULL DEFAULT '',
    "field" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    -- false = machine draft awaiting the clinic's review; true = a human
    -- who speaks the language has confirmed or corrected it.
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Translation_locale_namespace_entityId_field_key"
    ON "Translation"("locale", "namespace", "entityId", "field");
CREATE INDEX "Translation_locale_namespace_idx" ON "Translation"("locale", "namespace");
