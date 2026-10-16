# Agreed conversation implementation — 16 October 2026

The owner authorised backend implementation after the conversation specification and Makoni walkthrough were reviewed. This supersedes the earlier instruction to make documentation-only changes.

## Implemented

- Sold, Paid and Returned structured messages, explicit cash input, integer-cent arithmetic and customer-level CHANGE/CHIKWERETI.
- Current-sale-first allocation for cash with a sale; FIFO for subsequent repayments.
- Full-or-none handback, CHANGE-funded sales, mixed funding, credit shortfalls and rejection of partial later cash returns.
- Clickable date and confirmation controls; customer-level due-date replacement/retention; unspecified first date; full-message re-entry; exact cancel/save acknowledgements.
- Durable sessions and receipts, ledger/reply atomicity, idempotent message intake, sender isolation and persisted reply identifiers.
- Reply Correct for saved journal entries, revision history, unchanged original until confirmation and Cancel retaining the original.
- The accepted four-event Makoni walkthrough is exercised in both unit and PostgreSQL integration tests. The human simulation was not itself a database test.

## Storage and upgrade

The existing tables remain intact. New transactions are stored in LedgerEntry and corrections in LedgerRevision; source message IDs and provider reply IDs connect WhatsApp context to the correct vendor-scoped record. The previous records are read as opening ledger history. The additive upgrade is in prisma/updates/20261016_transaction_ledger.sql and is tested against the prior schema fixture.

Only the new journal is written by transaction commands. The records API projects current accounts and a compatible sales/payments/expenses view; revision history prevents replacement transactions being counted as extra sales or payments.

No live database or Meta account was changed by the implementation task.

## Explicit boundaries

- Saved corrections with later dependent customer activity are blocked. The core reply/re-entry/confirm workflow is implemented, but broader historical recomputation remains unresolved in the business specification.
- Legacy records have no complete original-message/journal history, so they remain readable but cannot be corrected through chat.
- USD only; no exchange-rate inference or identity guessing for duplicate names.
- For the unresolved Next Friday-on-another-weekday case, use the next strictly future occurrence and show its exact calendar date for review. Today is explicit. Queued answers resolve against their receipt date in Africa/Harare.
- New relative dates during correction resolve against the correction answer's receipt date; Skip retains the captured date. Backdated transaction entry is not supported.
- Unsupported old workbook instructions that require simultaneous CHANGE and CHIKWERETI or partial cash handbacks do not override the owner's later approved rules.

These boundaries are documented so a future extension does not silently change money already recorded.
