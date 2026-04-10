-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('ACTIVE', 'OPENED', 'EXPIRED', 'DESTROYED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'SUBMITTED', 'OPENED', 'EXPIRED', 'DESTROYED');

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'AES-GCM',
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "destroyedAt" TIMESTAMP(3),
    "passphraseRequired" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "requestId" TEXT,
    "status" "SecretStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "destroyedAt" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secret_requestId_key" ON "Secret"("requestId");

-- CreateIndex
CREATE INDEX "Secret_status_expiresAt_idx" ON "Secret"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecretRequest_token_key" ON "SecretRequest"("token");

-- CreateIndex
CREATE INDEX "SecretRequest_token_status_expiresAt_idx" ON "SecretRequest"("token", "status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SecretRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
