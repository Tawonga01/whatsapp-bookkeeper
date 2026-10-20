import type { BotResponse } from "../domain/types.js";

export type WhatsAppClientConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
};
export class WhatsAppConfigError extends Error {}
export class WhatsAppDeliveryError extends Error {
  constructor(readonly status: number, readonly code?: number, readonly subcode?: number) {
    super(`WhatsApp send failed (HTTP ${status}).`);
    this.name = 'WhatsAppDeliveryError';
  }
}
export class WhatsAppClient {
  constructor(private readonly config: WhatsAppClientConfig) {}
  isConfigured(): boolean {
    return Boolean(
      this.config.accessToken &&
        /^\d+$/.test(this.config.phoneNumberId ?? "") &&
        /^v\d+\.\d+$/.test(this.config.apiVersion ?? ""),
    );
  }
  async sendTextMessage(input: {
    to: string;
    text: string;
  }): Promise<string | undefined> {
    return this.sendResponse(input.to, { text: input.text });
  }
  async sendResponse(
    to: string,
    response: BotResponse,
  ): Promise<string | undefined> {
    if (!this.isConfigured())
      throw new WhatsAppConfigError(
        "Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_API_VERSION.",
      );
    let content: Record<string, unknown> = {
      type: "text",
      text: { preview_url: false, body: response.text.slice(0, 4096) },
    };
    if (response.text.length <= 1024 && response.choices?.length) {
      content = {
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: response.text },
          action: {
            button: "Choose an option",
            sections: [
              {
                title: "MUSIKA ACCOUNTANT",
                rows: response.choices
                  .slice(0, 10)
                  .map((c) => ({ id: c.id, title: c.title.slice(0, 24) })),
              },
            ],
          },
        },
      };
    } else if (response.text.length <= 1024 && response.buttons?.length) {
      content = {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: response.text },
          action: {
            buttons: response.buttons
              .slice(0, 3)
              .map((b) => ({
                type: "reply",
                reply: { id: b.id, title: b.title.slice(0, 20) },
              })),
          },
        },
      };
    }
    const result = await fetch(
      `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          ...content,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!result.ok) {
      // Never retain/log the raw response: it may contain personal or credential data.
      const failure = await result.json().catch(() => null) as { error?: { code?: unknown; error_subcode?: unknown } } | null;
      const numeric = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
      throw new WhatsAppDeliveryError(result.status, numeric(failure?.error?.code), numeric(failure?.error?.error_subcode));
    }
    const body = (await result.json()) as {
      messages?: Array<{ id?: unknown }>;
    };
    return typeof body.messages?.[0]?.id === "string"
      ? body.messages[0].id
      : undefined;
  }
}
export function createWhatsAppClientFromEnv(): WhatsAppClient {
  return new WhatsAppClient({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION,
  });
}
