import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function verifySignature(
  body: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
const message = z.object({
  id: z.string().min(1).max(250),
  from: z.string().regex(/^\d{7,15}$/),
  type: z.string(),
  text: z.object({ body: z.string().max(4096) }).optional(),
  interactive: z
    .object({
      type: z.string(),
      list_reply: z.object({ id: z.string() }).optional(),
      button_reply: z.object({ id: z.string() }).optional(),
    })
    .optional(),
  button: z.object({ payload: z.string() }).optional(),
  context: z.object({ id: z.string().min(1).max(250) }).optional(),
});
const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z
            .object({
              metadata: z.object({ phone_number_id: z.string() }).optional(),
              messages: z.array(message).optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  ),
});
export type IncomingMessage = {
  id: string;
  from: string;
  text: string;
  replyTo?: string;
};
export function extractMessages(
  payload: unknown,
  phoneNumberId: string,
): IncomingMessage[] {
  const parsed = payloadSchema.parse(payload);
  return parsed.entry
    .flatMap((e) => e.changes)
    .filter(
      (c) =>
        c.field === "messages" &&
        c.value.metadata?.phone_number_id === phoneNumberId,
    )
    .flatMap((c) => c.value.messages ?? [])
    .map((m) => ({
      id: m.id,
      from: m.from,
      ...(m.context ? { replyTo: m.context.id } : {}),
      text:
        (m.type === "text"
          ? m.text?.body
          : m.type === "interactive"
            ? (m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id)
            : m.type === "button"
              ? m.button?.payload
              : undefined) ?? "[unsupported message: send MENU]",
    }));
}
