-- Phase 8: public site builder, blog/health library, gallery, feedback.
-- Hand-written and applied with `prisma migrate deploy`, per the workflow
-- established in Phase 2.

ALTER TABLE "Clinic" ADD COLUMN "publicSections" JSONB;
ALTER TABLE "Clinic" ADD COLUMN "publicTheme" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "heroImagePath" TEXT;
ALTER TABLE "Clinic" ADD COLUMN "mapEmbedUrl" TEXT;

CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImagePath" TEXT,
    "tags" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- Unique so /blog/:slug stays stable across title edits.
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_published_publishedAt_idx" ON "BlogPost"("published", "publishedAt");

ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "ClinicUser"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "caption" TEXT,
    "storagePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryPhoto_sortOrder_idx" ON "GalleryPhoto"("sortOrder");

-- Patient feedback. isPublished defaults false and is intended to stay
-- false -- see the model comment in schema.prisma for the NMC/MCI position
-- on publishing patient testimonials in India.
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "patientName" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "visitDate" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_submittedAt_idx" ON "Feedback"("submittedAt");
CREATE INDEX "Feedback_isPublished_idx" ON "Feedback"("isPublished");
