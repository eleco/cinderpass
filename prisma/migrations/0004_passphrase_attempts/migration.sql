-- AlterTable
ALTER TABLE "Secret"
ADD COLUMN "passphraseAttempts" INTEGER NOT NULL DEFAULT 0;
