# WhatsApp Cloud API Setup Notes

This project targets the official Meta WhatsApp Business Platform Cloud API.

## Needed Credentials

Add these to `.env` when ready:

```text
WHATSAPP_VERIFY_TOKEN=your-local-secret
WHATSAPP_ACCESS_TOKEN=meta-access-token
WHATSAPP_PHONE_NUMBER_ID=meta-phone-number-id
WHATSAPP_API_VERSION=v21.0
```

## Webhook URLs

For local development, expose the app with a tunnel such as ngrok or Cloudflare Tunnel.

```text
GET  /whatsapp/webhook
POST /whatsapp/webhook
```

Meta calls the `GET` endpoint during webhook verification. Incoming shopkeeper messages arrive on the `POST` endpoint.

## Webhook Verification

Set the same verify token in Meta and in `.env`:

```text
WHATSAPP_VERIFY_TOKEN=your-local-secret
```

When Meta verifies the webhook, the app checks `hub.verify_token` and returns `hub.challenge` if it matches.

## Outbound Replies

When the app receives a text message, it:

1. Parses the command.
2. Saves or stages the bookkeeping action.
3. Sends the bot response back to the same WhatsApp number through the Cloud API.

The outbound request uses:

```text
POST https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages
```

with a bearer token from `WHATSAPP_ACCESS_TOKEN`.

## Local Development

The `/simulate` route does not send WhatsApp messages. It returns the bot response as JSON so the parser, confirmation flow, and database records can be tested without Meta credentials.

If the webhook receives messages but WhatsApp credentials are missing, the app logs a warning and skips the outbound send. This keeps webhook testing safe before production credentials are added.
