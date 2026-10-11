-- CreateEnum
CREATE TYPE "EmbeddingKind" AS ENUM ('INTENT_CACHE', 'USER_TASTE', 'BUSINESS_OFFER', 'BIZ_CUSTOMER', 'UNFULFILLED_DEMAND');

-- AlterTable: Intently Marketplace Integration Fields on Business
ALTER TABLE "businesses"
  ADD COLUMN "businessOsId" TEXT,
  ADD COLUMN "intentlyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "intentlyCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "intentlyRadius" DOUBLE PRECISION,
  ADD COLUMN "intentlyPlan" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN "autoAcceptUnder" INTEGER,
  ADD COLUMN "responseTargetMin" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex
CREATE UNIQUE INDEX "businesses_businessOsId_key" ON "businesses"("businessOsId");

-- CreateTable
CREATE TABLE "embedding_records" (
    "id" TEXT NOT NULL,
    "kind" "EmbeddingKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embedding_records_kind_refId_idx" ON "embedding_records"("kind", "refId");

-- CreateIndex
CREATE INDEX "embedding_records_businessId_idx" ON "embedding_records"("businessId");

-- AddForeignKey
ALTER TABLE "embedding_records" ADD CONSTRAINT "embedding_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector column + ivfflat index (Unsupported by Prisma's schema — pgvector,
-- managed via raw SQL per apps/api/src/services/vector/*.ts).
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "embedding_records" ADD COLUMN "vector" vector(768);
CREATE INDEX "embedding_records_vector_idx" ON "embedding_records" USING ivfflat ("vector" vector_cosine_ops) WITH (lists = 100);
