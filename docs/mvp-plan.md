# MVP Plan

## Goal

Build a WhatsApp-first bookkeeping assistant for shopkeepers who need to quickly record cash sales, credit sales, and customer payments from the counter.

## First User Flow

1. Shopkeeper sends a short structured message.
2. Bot parses the message.
3. Bot sends a confirmation.
4. Shopkeeper replies `YES`.
5. Bot saves the record.
6. Shopkeeper can ask for summaries, debtors, due payments, and report emails.

## Commands

```text
cash <item> <quantity> <amount> [customer]
credit <item> <quantity> <amount> <customer> <due date>
paid <customer> <amount>
debtors
due today
overdue
summary
email report
```

## Build Order

1. Local simulator and parser
2. Confirmation flow
3. In-memory records
4. WhatsApp webhook verification and inbound parsing
5. PostgreSQL persistence
6. WhatsApp reply sending
7. Debtor reminders
8. Weekly reconciliation job
9. Email reports
10. Lightweight dashboard

## Data Model Direction

- shops
- users
- customers
- items
- sales
- payments
- pending_confirmations
- report_runs
- reminder_runs

## Notes

Structured commands come first because bookkeeping data needs to be reliable. AI parsing can be added later as an optional helper for messy messages, but it should still ask for confirmation before saving.
