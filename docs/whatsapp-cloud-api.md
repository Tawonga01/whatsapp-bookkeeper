# WhatsApp Cloud API Setup Notes

This project targets the official Meta WhatsApp Business Platform Cloud API.

## Needed Credentials

Add these to `.env` when ready:

```text
WHATSAPP_VERIFY_TOKEN=your-local-secret
WHATSAPP_ACCESS_TOKEN=meta-access-token
WHATSAPP_PHONE_NUMBER_ID=meta-phone-number-id
```

## Webhook URLs

For local development, expose the app with a tunnel such as ngrok or Cloudflare Tunnel.

```text
GET  /whatsapp/webhook
POST /whatsapp/webhook
```

Meta calls the `GET` endpoint during webhook verification. Incoming customer messages arrive on the `POST` endpoint.

## Current State

The app can receive and parse inbound webhook payloads, but it currently logs the reply instead of sending it back through the WhatsApp API. The next WhatsApp step is to add an outbound sender that calls Meta's messages endpoint.
