# Free-tier standby deployment

Use Render Free in Frankfurt and the existing MUSIKA Neon Free PostgreSQL project.
This is a preparation/test deployment, not an always-on production service.
Render Free sleeps when idle; Neon Free has compute/storage quotas and limited recovery history.
The current database polling worker will consume Neon compute while enabled; reassess limits before activating WhatsApp.

Render settings:

- Runtime: Node; `NODE_VERSION=22`
- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/health`
- `NODE_ENV=production`, `ENABLE_DEV_API=false`, `BOOKKEEPING_CURRENCY=USD`
- `WHATSAPP_ENABLED=false` until Meta onboarding and end-to-end tests are ready.
- `DATABASE_URL`: Neon TLS connection string, stored only as a Render secret.
- `WHATSAPP_VERIFY_TOKEN`: generated private secret; never commit its value.

Standby disables the worker and webhook processing even if stale Meta credentials exist.
`/simulate` and `/records` are not mounted. `/health` reports WhatsApp unconfigured;
it is process liveness, not continuous database readiness.

For a newly created empty database only, initialize with Prisma `db push` once using
the same schema in this repository. Never use `--accept-data-loss`, reset, or the
demo seed. Do not put schema changes in every application start command.
For an existing database use the reviewed additive upgrade instead.

Before storing real vendor records, arrange encrypted off-provider PostgreSQL
exports and verify restoration into a separate database. Free-plan short recovery
history is not a complete backup strategy. Backups and monitoring must be explicitly
verified; creating the service alone does not complete them.

To activate later, configure all Meta secrets/IDs/version and set
`WHATSAPP_ENABLED=true`; startup still fails closed when credentials are incomplete.
