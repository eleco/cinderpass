-- AlterTable
ALTER TABLE "Secret"
ADD COLUMN "destroyToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Secret_destroyToken_key" ON "Secret"("destroyToken");
