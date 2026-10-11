-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "serviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "offers_productId_key" ON "offers"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_serviceId_key" ON "offers"("serviceId");
