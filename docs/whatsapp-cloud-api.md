# WhatsApp Cloud API — MUSIKA ACCOUNTANT

## Current state

The business contact is **+263 71 398 2781** (`263713982781` in international digits). The owner confirmed it is not set up yet. Code is ready for controlled testing; no real message has been sent by this build.

The public phone number is **not** `WHATSAPP_PHONE_NUMBER_ID`. Meta supplies a separate numeric ID after the number is added. `WHATSAPP_BUSINESS_NUMBER` is informational only.

## Owner setup checklist

1. Open the Meta developer/business dashboards using the business owner's account. Create/select the business portfolio and app with WhatsApp enabled. Review Meta's current business/number eligibility and verification requirements there.
2. Start with Meta's test number and an approved test recipient. Keep the real business number unchanged until that flow works.
3. When ready, add and verify +263 71 398 2781 with Meta's displayed registration flow. If the number has since been registered in a phone app, check Meta's migration/coexistence eligibility before changing that registration. Do not delete an existing WhatsApp account as a shortcut.
4. Put the access token, app secret, phone-number ID and a supported Graph API version into local or host-managed secrets. Choose a separate, random webhook verification token. Do not send these secrets in chat or commit `.env`.
5. Deploy this backend with a persistent PostgreSQL database and public HTTPS. Use `NODE_ENV=production`, `ENABLE_DEV_API=false` and complete all WhatsApp settings. Configure an appropriate long-lived access token/permissions in Meta, not a temporary development token for production.
6. Set callback URL `https://<your-backend-host>/whatsapp/webhook` and the matching verify token in Meta. Subscribe the app/business account to incoming `messages` events as required by the dashboard. The Sites landing-page URL is not the Express API host.
7. Test MENU, a cash sale, cancellation, credit, partial payment and summary from a consenting test vendor's phone. Inspect the actual WhatsApp list/buttons and database records. Do not invite public vendors before this end-to-end test and the launch safeguards in the README.

The phone number alone does not activate replies. Billing/account approvals, supported API versions and UI labels are controlled by Meta and should be checked during setup.

## Environment mapping

| Variable | Meaning |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Secret bearer token authorized to send from the business account |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta's numeric API ID, not the public phone number |
| `WHATSAPP_APP_SECRET` | App secret used to verify raw webhook HMAC-SHA256 signatures |
| `WHATSAPP_VERIFY_TOKEN` | A random secret chosen by us for callback verification |
| `WHATSAPP_API_VERSION` | Supported Graph API version from the app configuration, in `vNN.N` form |
| `DATABASE_URL` | Private PostgreSQL connection string |
| `BOOKKEEPING_CURRENCY` | Single pilot currency, initially USD |

## Delivery and operations

- Invalid or missing `X-Hub-Signature-256` is rejected before processing.
- Only incoming events for the configured phone-number ID are queued; status events are ignored.
- Message IDs are unique. Ledger, draft state and generated reply commit together under a per-sender database lock.
- The in-process worker resumes stored work after restart. Database-backed receipt/reply records are required; do not replace them with memory-only state.
- Network delivery retries do not rerun bookkeeping. An ambiguous send failure can repeat the response; monitor stale/failed rows before launch.
- This build only sends replies to inbound users. Proactive messaging/templates and opt-in workflows are not implemented.

## Official references

- [Meta WhatsApp Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Meta webhook setup](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
- [Meta's WhatsApp Business Platform API collection](https://www.postman.com/meta/whatsapp-business-platform/overview)
