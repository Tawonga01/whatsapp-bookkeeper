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
- PostgreSQL + Prisma
- Background jobs planned for reconciliation and reminders
- Email provider planned for scheduled reports

## Current Build

This scaffold includes:

- local message simulator endpoint
- WhatsApp webhook verification endpoint
- WhatsApp inbound message receiver shape
- template command parser
- confirmation flow
- PostgreSQL-backed sales, payments, customers, items, shops, and pending confirmations
- debtor and summary responses
- email report stub

Actual WhatsApp reply sending, scheduled jobs, and email delivery are next.

## Local Run

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`, then set `DATABASE_URL` for a local PostgreSQL database.

Create the database tables:

```bash
npm run db:push
```

Optional demo records:

```bash
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Then test with:

```bash
curl -X POST http://localhost:3000/simulate \
  -H "Content-Type: application/json" \
  -d '{"from":"shop-1","text":"credit rice 1 1200 mary friday"}'
```

Reply `YES` through the simulator to save the pending sale.

Check stored records:

```bash
curl http://localhost:3000/records
```
