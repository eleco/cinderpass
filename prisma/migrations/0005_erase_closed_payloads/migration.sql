-- One-time removal of payloads retained by older releases. Keep active links valid.
-- This changes live database rows, not historical provider backups or WAL retention.
UPDATE "Secret"
SET "status" = CASE WHEN "status" = 'ACTIVE' THEN 'EXPIRED'::"SecretStatus" ELSE "status" END,
    "destroyedAt" = COALESCE("destroyedAt", (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')),
    "ciphertext" = '', "iv" = '', "note" = NULL,
    "passphraseSalt" = NULL, "passphraseVerifier" = NULL, "destroyToken" = NULL
WHERE "status" <> 'ACTIVE' OR "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');

UPDATE "SecretRequest"
SET "status" = CASE WHEN "status" IN ('OPEN', 'SUBMITTED') THEN 'EXPIRED'::"RequestStatus" ELSE "status" END,
    "destroyedAt" = COALESCE("destroyedAt", (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')),
    "label" = '', "note" = NULL
WHERE "status" IN ('OPENED', 'EXPIRED', 'DESTROYED') OR "expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
