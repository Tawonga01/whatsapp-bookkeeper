# MUSIKA ACCOUNTANT — WhatsApp backend

Bookkeeping for Zimbabwean vendors. This project implements the agreed conversation flows in [the transaction specification](docs/transaction-specification.md) and [the accepted Makoni walkthrough](docs/accepted-walkthrough.md).

Business contact: **+263 713 982 783**. The backend is locally testable; the live WhatsApp connection and hosted database are not configured by this change. Meta setup is paused while the account is under review.

## What the bot does

Send a complete transaction:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars
Makoni - Paid - 5 dollars
Makoni - Returned - 3.60 dollars
```

- Quantity × unit price determines sale value. Cash received is separate and can be zero. Missing cash is asked for explicitly.
- CHANGE is money owed to the customer. CHIKWERETI is money owed to the vendor.
- Cash with a sale pays for that sale first, then oldest CHIKWERETI. Later payments settle oldest credit first.
- Excess cash asks `Did you give it back?` with Yes/No buttons. Cash handback is all or none; later CHANGE returns must also be in full.
- Available CHANGE is offered to fund an unpaid sale, including mixed cash/CHANGE and a remaining credit amount. No rejects the interpretation and asks for re-entry; it cannot preserve CHANGE while creating CHIKWERETI.
- New credit asks `When will Makoni pay?` with total CHIKWERETI and clickable Enter date/Skip controls. A new date replaces the customer's date. Skip retains it or leaves it unspecified when none exists.
- Weekdays and Next Friday use the next occurrence strictly after the message's Harare day. Today means today. The actual date is displayed for review. Live queued messages use their receipt date, not the worker's later restart date.
- Confirm saves and replies `Transaction saved.` Correct asks for complete re-entry. Cancel replies `Transaction cancelled.` Drafts expire after 30 minutes without saving.
- Reply to an identified saved transaction with Correct, enter its replacement, and Confirm. The original stays effective until confirmation; corrections retain an audit history and reply `Transaction corrected.`

Each vendor's records are scoped to their WhatsApp sender ID. One sender represents one shop. USD is the only supported currency in this pilot. Changing the configured currency is rejected rather than silently relabelling money.

Other commands: `SUMMARY`, `DEBTORS`, `CHANGE`, `DUE TODAY`, `OVERDUE`, `HELP`. Expenses can be entered as `expense transport 2.50`. Older `cash <item> <qty> <total> [customer]`, `credit <item> <qty> <total> <customer> <due>` and `paid <customer> <amount>` shortcuts remain supported; their numeric amount is a total, unlike the `Sold` quantity × unit-price syntax. All use final Confirm. A plain Yes cannot save a final confirmation.

## Run locally

Use Node.js 22 or 24, PostgreSQL, and this project's lockfile.

```powershell
npm ci
Copy-Item .env.example .env
```

Set DATABASE_URL locally. For simulation, set ENABLE_DEV_API=true and a random DEV_API_KEY of at least 24 characters. Keep credentials out of chat and Git.

For a **new empty development database**:

```powershell
npm run db:push
npm run build
npm run dev
```

For an **existing database on the previous schema**, back it up and review the additive SQL before applying it once:

```powershell
npx prisma db execute --file prisma/updates/20261016_transaction_ledger.sql --schema prisma/schema.prisma
npm run build
```

The upgrade adds LedgerEntry, LedgerRevision and reply-reference columns. It does not drop or rewrite existing Sale/Payment/Expense data. Existing sender-scoped legacy records are read as opening history; new entries use the ledger. The legacy shared demo shop is not automatically assigned to a phone. Do not run the old demo seed against a live ledger. Establish a full migration baseline before subsequent production migrations. Never use reset or accept-data-loss against real records.

The current environment has no project .env database configuration; this code change does not connect to or upgrade a live database.

## Local simulation

When enabled, the API binds to 127.0.0.1 and requires authentication. In a second PowerShell terminal, set DEV_API_KEY to the same private local value, then:

```powershell
$headers = @{ Authorization = "Bearer $env:DEV_API_KEY" }
$body = @{ from = 'vendor-demo'; text = 'Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3000/simulate -Method Post -Headers $headers -ContentType 'application/json' -Body $body
```

Repeat with the same from and text Sunday (or Skip), then Confirm. Responses contain button titles and token-bound IDs. A simulator UI should send the selected button ID back as text; ordinary typed replies also work.

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/records?sender=sim:vendor-demo' -Headers $headers
```

Records include transactions, customer accounts, sales, payments and expenses. Monetary fields inside transaction.data are integer cents; accounts/sales/payments/expenses expose dollar amounts. Do not add debt payments to sale revenue.

To test a saved correction, send text Correct with replyTo set to a transaction ID from records (or its sourceMessageId), then re-enter the complete transaction. This mirrors the WhatsApp reply context. No unrelated vendor's transaction can be selected.

## Verification

```powershell
npm run prisma:generate
npm run typecheck
npm test
npm run test:integration
npm run build
```

The unit tests run the accepted walkthrough and the main CHANGE/CHIKWERETI branches. API checks cover HMAC validation, authentication, reply context and outgoing UI payloads. Integration checks start disposable PostgreSQL, provision the old schema, insert legacy data, apply the upgrade, and verify preservation, state recovery, duplicate deliveries, transaction rollback, audited corrections, reply mapping and vendor isolation. They do not use a live business account or database.

The patched deepmerge-ts override is retained for Prisma's configuration dependency. Recheck it when upgrading Prisma.

## Supported correction boundary

The latest ledger entry for an affected customer can be corrected with full-message re-entry and revision history. If later customer activity depends on the entry, correction is blocked with an explanation. Legacy rows remain readable but cannot be corrected through the new reply workflow. Those cases need the additional business review already identified in [the correction specification](docs/saved-transaction-corrections.md).

For corrections, Skip retains the existing captured customer date. Explicit new relative dates resolve against the date the correction answer is received; the resolved calendar date is shown before saving. No backdated transaction-entry command is implemented.

## WhatsApp connection and remaining work

See [the connection checklist](docs/whatsapp-cloud-api.md). Production keeps the simulator disabled. Incoming message receipts, ledger changes, draft state and response commit atomically. Outbound replies are retried separately and their message IDs are stored so replies to confirmations can identify transactions. An ambiguous send failure may duplicate a reply, but never re-records the transaction. Stale button IDs cannot apply to another draft or step.

Meta account approval, actual phone testing, persistent hosting and deployment remain. Automated Meta dashboard actions have not been resumed.

Other unimplemented areas include stock valuation, tax/profit calculations, goods refunds, multiple currencies, voice/photos, email, reminders and shared shop staff. Duplicate human names still require consistent distinct customer names; the bot does not guess identities. Queue monitoring, retention policies and production backup/restore operations remain deployment work.
