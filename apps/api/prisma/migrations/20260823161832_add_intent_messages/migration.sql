-- CreateEnum
CREATE TYPE "IntentMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "intent_messages" (
    "id" TEXT NOT NULL,
    "intentRequestId" TEXT NOT NULL,
    "role" "IntentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "intent_messages" ADD CONSTRAINT "intent_messages_intentRequestId_fkey" FOREIGN KEY ("intentRequestId") REFERENCES "intent_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
