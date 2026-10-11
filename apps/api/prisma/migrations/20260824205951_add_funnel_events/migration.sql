-- CreateEnum
CREATE TYPE "FunnelEventType" AS ENUM ('INTENT_SUBMITTED', 'RESULTS_SHOWN', 'RESULT_OPENED', 'COMPARED', 'BOOKED');

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "FunnelEventType" NOT NULL,
    "intentRequestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_events_userId_idx" ON "funnel_events"("userId");

-- CreateIndex
CREATE INDEX "funnel_events_eventType_idx" ON "funnel_events"("eventType");

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
