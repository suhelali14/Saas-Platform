-- Subscriptions for every product, sold from this console (Growth now,
-- clinics next): the catalogue, the yearly discount, Razorpay plans and
-- subscriptions, and each paid cycle. Additive: nothing existing changes.

CREATE TYPE "Product" AS ENUM ('CLINIC', 'GROWTH');
CREATE TYPE "SubInterval" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "SubStatus" AS ENUM ('CREATED', 'AUTHENTICATED', 'ACTIVE', 'PENDING', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

CREATE TABLE "BillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "yearlyDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "BillingSettings" ("id") VALUES ('default');

CREATE TABLE "CatalogOffer" (
    "id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grants" JSONB NOT NULL,
    "monthlyPricePaise" INTEGER,
    "yearlyDiscountPct" DECIMAL(5,2),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "accountRef" TEXT,
    "accountName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CatalogOffer_product_code_key" ON "CatalogOffer"("product", "code");

-- Growth's catalogue as the founder set it on 28 November 2026 (Growth's
-- D53): the three plans at his monthly prices, Growth's fee only; the
-- single modules are not on sale until he prices them here.
INSERT INTO "CatalogOffer" ("id", "product", "code", "kind", "name", "summary", "includes", "grants", "monthlyPricePaise", "published", "position") VALUES
('growth:plan-10k', 'GROWTH', 'plan-10k', 'plan', 'Starter', 'Reviews and WhatsApp working for you every day',
 ARRAY['Reviews QR: the counter card, the review page and your Google rating', 'WhatsApp automation: the assistant, automatic replies and messages to old customers', '4 videos a month'],
 '{"modules":["reviews","whatsapp"],"videosMonth":4,"aiSecondsMonth":0}', 1000000, true, 10),
('growth:plan-15k', 'GROWTH', 'plan-15k', 'plan', 'Growth', 'Everything in Starter, with ads that bring new customers',
 ARRAY['Everything in Starter', 'Ads on Facebook and Instagram, every chat and booking from them counted', '10 videos a month'],
 '{"modules":["reviews","whatsapp","ads"],"videosMonth":10,"aiSecondsMonth":0}', 1500000, true, 20),
('growth:plan-25k', 'GROWTH', 'plan-25k', 'plan', 'Pro', 'Every tool, and AI footage in your videos',
 ARRAY['Everything in Growth', 'Find customers online: the market brief, plays and leads', '20 videos a month, with 48 seconds of AI footage'],
 '{"modules":["reviews","whatsapp","ads","online"],"videosMonth":20,"aiSecondsMonth":48}', 2500000, true, 30),
('growth:module-reviews', 'GROWTH', 'module-reviews', 'module', 'Reviews QR', 'More Google reviews from the customers already in your shop',
 ARRAY['The counter card with your logo', 'The review page in English, Hindi and Marathi', 'Your Google rating and what customers told only you'],
 '{"modules":["reviews"],"videosMonth":0,"aiSecondsMonth":0}', NULL, false, 110),
('growth:module-whatsapp', 'GROWTH', 'module-whatsapp', 'module', 'WhatsApp automation', 'Answers, bookings and offers on WhatsApp while you work',
 ARRAY['The WhatsApp assistant with your menu and bookings', 'Automatic replies', 'Messages to old customers, with what they brought'],
 '{"modules":["whatsapp"],"videosMonth":0,"aiSecondsMonth":0}', NULL, false, 120),
('growth:module-ads', 'GROWTH', 'module-ads', 'module', 'Ads', 'Facebook and Instagram ads that open a WhatsApp chat with you',
 ARRAY['Ads around your area or across India', 'Every chat and booking from an ad counted'],
 '{"modules":["ads"],"videosMonth":0,"aiSecondsMonth":0}', NULL, false, 130),
('growth:module-online', 'GROWTH', 'module-online', 'module', 'Find customers online', 'People asking for what you sell, with a reply ready',
 ARRAY['The market brief', 'Plays that search Reddit, YouTube and more', 'Leads with drafted replies'],
 '{"modules":["online"],"videosMonth":0,"aiSecondsMonth":0}', NULL, false, 140);

CREATE TABLE "RazorpayPlan" (
    "id" TEXT NOT NULL,
    "interval" "SubInterval" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RazorpayPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RazorpayPlan_interval_amountPaise_name_key" ON "RazorpayPlan"("interval", "amountPaise", "name");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "accountRef" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "offerCodes" TEXT[],
    "offerNames" TEXT[],
    "grants" JSONB NOT NULL,
    "interval" "SubInterval" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "razorpayPlanId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "shortUrl" TEXT,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "status" "SubStatus" NOT NULL DEFAULT 'CREATED',
    "currentStart" TIMESTAMP(3),
    "currentEnd" TIMESTAMP(3),
    "cancelAtEnd" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "replacesId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");
CREATE INDEX "Subscription_product_accountRef_idx" ON "Subscription"("product", "accountRef");

CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "pushedAt" TIMESTAMP(3),
    "pushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionCharge_paymentId_key" ON "SubscriptionCharge"("paymentId");
CREATE INDEX "SubscriptionCharge_pushedAt_idx" ON "SubscriptionCharge"("pushedAt");
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma sets updatedAt itself; the defaults were only for the rows above.
ALTER TABLE "BillingSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CatalogOffer" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;
