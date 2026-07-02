export type WhatsAppClientConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
};

export type SendTextMessageInput = {
  to: string;
  text: string;
};

export class WhatsAppConfigError extends Error {}

export class WhatsAppClient {
  private readonly accessToken?: string;
  private readonly phoneNumberId?: string;
  private readonly apiVersion: string;

  constructor(config: WhatsAppClientConfig) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.apiVersion = config.apiVersion ?? "v21.0";
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  async sendTextMessage(input: SendTextMessageInput): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new WhatsAppConfigError("WhatsApp credentials are missing. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.");
    }

    const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: {
          preview_url: false,
          body: input.text,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`WhatsApp send failed with ${response.status}: ${details}`);
    }
  }
}

export function createWhatsAppClientFromEnv(): WhatsAppClient {
  return new WhatsAppClient({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION,
  });
}
