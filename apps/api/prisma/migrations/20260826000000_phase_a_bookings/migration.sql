-- Migration: Phase A — Consumer Transaction Rail
-- Adds Razorpay keys to businesses, Expo push token to business_users,
-- and the new bookings table with BookingStatus / PaymentMode enums.
-- Also makes reviews.transaction_id nullable so reviews can link to
-- either a legacy Transaction or a new Booking.
--
-- IMPORTANT: Do NOT include CREATE EXTENSION vector or touch
-- embedding_records.vector — those are managed separately by raw SQL
-- and will cause EPERM errors if Prisma tries to diff them.

-- 1. Razorpay keys on businesses (nullable — businesses opt in)
ALTER TABLE "businesses"
  ADD COLUMN "razorpayKeyId"     TEXT,
  ADD COLUMN "razorpayKeySecret" TEXT;

-- 2. Expo push token on business_users
ALTER TABLE "business_users"
  ADD COLUMN "expoPushToken" TEXT;

-- 3. Make reviews.transactionId nullable (was NOT NULL)
--    so reviews can be linked to a Booking instead.
ALTER TABLE "reviews"
  ALTER COLUMN "transactionId" DROP NOT NULL;
ALTER TABLE "reviews"
  ADD COLUMN "bookingId" TEXT UNIQUE;

-- 4. New enums
CREATE TYPE "BookingStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "PaymentMode" AS ENUM (
  'PAY_AT_VENUE',
  'RAZORPAY'
);

-- 5. New bookings table
CREATE TABLE "bookings" (
  "id"                TEXT         NOT NULL,
  "userId"            TEXT         NOT NULL,
  "businessId"        TEXT         NOT NULL,
  "offerId"           TEXT         NOT NULL,
  "matchId"           TEXT,

  "scheduledAt"       TIMESTAMP(3) NOT NULL,
  "durationMin"       INTEGER      NOT NULL DEFAULT 60,
  "notes"             TEXT,
  "status"            "BookingStatus" NOT NULL DEFAULT 'PENDING',

  "amount"            INTEGER      NOT NULL,
  "currency"          TEXT         NOT NULL DEFAULT 'INR',
  "paymentMode"       "PaymentMode" NOT NULL DEFAULT 'PAY_AT_VENUE',

  "razorpayOrderId"   TEXT         UNIQUE,
  "razorpayPaymentId" TEXT         UNIQUE,

  "businessOrderId"   TEXT,
  "appointmentId"     TEXT,

  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bookings_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "bookings_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "users"("id"),
  CONSTRAINT "bookings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id"),
  CONSTRAINT "bookings_offerId_fkey"    FOREIGN KEY ("offerId")    REFERENCES "offers"("id")
);

CREATE INDEX "bookings_userId_idx"              ON "bookings"("userId");
CREATE INDEX "bookings_businessId_idx"          ON "bookings"("businessId");
CREATE INDEX "bookings_businessId_status_idx"   ON "bookings"("businessId", "status");
CREATE INDEX "bookings_businessId_scheduled_idx" ON "bookings"("businessId", "scheduledAt");

-- 6. Add bookingId FK to reviews (now that bookings table exists)
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id");
