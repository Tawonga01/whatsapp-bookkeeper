# WhatsApp Bookkeeper

A WhatsApp-first bookkeeping assistant for shopkeepers. The MVP focuses on fast sales logging, credit tracking, due payment visibility, weekly reconciliation, and email-ready records.

## MVP Commands

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

Examples:

```text
cash sugar 2 500
cash bread 1 150 mary
credit rice 1 1200 mary friday
paid mary 500
```

The bot confirms sales before saving. A shopkeeper replies `YES` to save the pending record.

## Tech Stack

- Node.js + Express
- TypeScript
- WhatsApp Business Platform Cloud API
- PostgreSQL + Prisma planned for persistence
- Background jobs planned for reconciliation and reminders
- Email provider planned for scheduled reports

## Current Build

This first scaffold includes:

- local message simulator endpoint
- WhatsApp webhook verification endpoint
- WhatsApp inbound message receiver shape
- template command parser
- confirmation flow
- in-memory sales and payment tracking
- debtor and summary responses
- email report stub

Persistence, actual WhatsApp sending, scheduled jobs, and email delivery are next.

## Local Run

```bash
npm install
npm run dev
```

Then test with:

```bash
curl -X POST http://localhost:3000/simulate \
  -H "Content-Type: application/json" \
  -d '{"from":"shop-1","text":"credit rice 1 1200 mary friday"}'
```

Reply `YES` through the simulator to save the pending sale.
