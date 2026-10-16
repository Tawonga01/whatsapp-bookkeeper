-- Additive upgrade from the previous MUSIKA schema. Run once, after a backup.
-- Existing Sale, Payment, Expense, Customer, Shop and pending records are retained.
BEGIN;
ALTER TABLE "InboundMessage" ADD COLUMN "outboundMessageId" TEXT, ADD COLUMN "replyToId" TEXT;
CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "data" JSONB NOT NULL,
  "currency" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "sourceMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LedgerRevision" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "previous" JSONB NOT NULL,
  "replacement" JSONB NOT NULL,
  "sourceMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerEntry_sequence_key" ON "LedgerEntry"("sequence");
CREATE INDEX "LedgerEntry_shopId_sequence_idx" ON "LedgerEntry"("shopId", "sequence");
CREATE UNIQUE INDEX "LedgerEntry_shopId_sourceMessageId_key" ON "LedgerEntry"("shopId", "sourceMessageId");
CREATE UNIQUE INDEX "LedgerRevision_entryId_revision_key" ON "LedgerRevision"("entryId", "revision");
CREATE UNIQUE INDEX "InboundMessage_outboundMessageId_key" ON "InboundMessage"("outboundMessageId");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerRevision" ADD CONSTRAINT "LedgerRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
