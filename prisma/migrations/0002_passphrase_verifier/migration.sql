-- AlterTable
ALTER TABLE "Secret"
ADD COLUMN "passphraseSalt" TEXT,
ADD COLUMN "passphraseVerifier" TEXT;
