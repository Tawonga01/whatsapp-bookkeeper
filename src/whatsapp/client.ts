import type { BotResponse } from "../domain/types.js";

export type WhatsAppClientConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
};
export class WhatsAppConfigError extends Error {}
export function classifyWhatsAppFailure(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unspecified';
  const fields = error as Record<string, unknown>;
  const data = fields.error_data as Record<string, unknown> | undefined;
  const text = [fields.message, fields.error_user_title, fields.error_user_msg, data?.details]
    .filter((v): v is string => typeof v === 'string').join(' ').toLowerCase();
  // Return fixed labels only. Never return provider text, identifiers or credentials.
  if (/payment|billing|credit line/.test(text)) return 'billing-or-payment';
  if (/terms|agreement|accept.*policy/.test(text)) return 'terms-acceptance';
  if (/allow.?list|allowed list|recipient.*list/.test(text)) return 'recipient-allowlist';
  if (/on behalf|whatsapp business account|waba/.test(text) && /permission|access/.test(text)) return 'whatsapp-account-access';
  if (/whatsapp_business_messaging/.test(text)) return 'messaging-permission';
  if (/whatsapp_business_management/.test(text)) return 'management-permission';
  if (/advanced access|app review/.test(text)) return 'app-review-access';
  if (/not registered|register.*phone/.test(text)) return 'phone-registration';
  if (/expired|invalid.*token|token.*invalid/.test(text)) return 'token-invalid-or-expired';
  if (/permission|authoriz|access denied/.test(text)) return 'permission-denied';
  if (/restrict|disabled|blocked/.test(text)) return 'account-restricted';
  return 'unspecified';
}
export class WhatsAppDeliveryError extends Error {
  constructor(readonly status: number, readonly code?: number, readonly subcode?: number, readonly reason = 'unspecified') {
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
      throw new WhatsAppDeliveryError(result.status, numeric(failure?.error?.code), numeric(failure?.error?.error_subcode), classifyWhatsAppFailure(failure?.error));
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
