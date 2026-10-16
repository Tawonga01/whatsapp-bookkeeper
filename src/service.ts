import { Prisma, PrismaClient } from "@prisma/client";
import { BookkeepingBot } from "./domain/bot.js";
import { BookkeepingStore } from "./domain/store.js";
import type { BotResponse } from "./domain/types.js";
import type { IncomingMessage } from "./whatsapp/webhook.js";
import type { WhatsAppClient } from "./whatsapp/client.js";
import type { MessageContext } from "./domain/transactions.js";
import { randomUUID } from "node:crypto";

export class AccountingService {
  constructor(
    private readonly db: PrismaClient,
    private readonly currency = "USD",
    private readonly clock?: () => Date,
  ) {
    if (currency !== "USD")
      throw new Error(
        "This pilot records USD only. Multi-currency bookkeeping is not configured.",
      );
  }
  async enqueue(messages: IncomingMessage[]) {
    // Sequential inserts preserve the order of messages in a webhook batch.
    await this.db.$transaction(async (tx) => {
      for (const m of messages)
        await tx.inboundMessage.createMany({
          data: [
            { id: m.id, senderId: m.from, text: m.text, replyToId: m.replyTo },
          ],
          skipDuplicates: true,
        });
    });
  }
  async simulate(sender: string, text: string, context: MessageContext = {}) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sender}))`;
      return new BookkeepingBot(
        new BookkeepingStore(tx, sender, this.currency),
        this.currency,
        this.clock,
      ).handleMessage(sender, text, {
        messageId: context.messageId ?? "sim:" + randomUUID(),
        replyTo: context.replyTo,
      });
    });
  }
  async records(sender: string) {
    return new BookkeepingStore(this.db, sender, this.currency).records();
  }
  async processNext() {
    const row = await this.db.inboundMessage.findFirst({
      where: { response: { equals: Prisma.DbNull } },
      orderBy: { sequence: "asc" },
    });
    if (!row) return false;
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.senderId}))`;
        const current = await tx.inboundMessage.findUniqueOrThrow({
          where: { id: row.id },
        });
        if (current.response !== null) return;
        const response = await new BookkeepingBot(
          new BookkeepingStore(tx, row.senderId, this.currency),
          this.currency,
          this.clock ?? (() => current.createdAt),
        ).handleMessage(row.senderId, row.text, {
          messageId: row.id,
          replyTo: row.replyToId ?? undefined,
        });
        await tx.inboundMessage.update({
          where: { id: row.id },
          data: {
            response: JSON.parse(
              JSON.stringify(response),
            ) as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 15000 },
    );
    return true;
  }
  async deliverNext(client: WhatsAppClient) {
    if (!client.isConfigured()) return false;
    const row = await this.db.inboundMessage.findFirst({
      where: {
        response: { not: Prisma.DbNull },
        deliveredAt: null,
        attempts: { lt: 12 },
        nextAttemptAt: { lte: new Date() },
        createdAt: { gt: new Date(Date.now() - 23 * 3600_000) },
      },
      orderBy: { sequence: "asc" },
    });
    if (!row) return false;
    // A delivery lock prevents two local/remote workers from sending the same row concurrently.
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"delivery:" + row.id}))`;
        const current = await tx.inboundMessage.findUniqueOrThrow({
          where: { id: row.id },
        });
        if (current.deliveredAt || current.nextAttemptAt > new Date()) return;
        try {
          const outboundMessageId = await client.sendResponse(
            row.senderId,
            row.response as unknown as BotResponse,
          );
          await tx.inboundMessage.update({
            where: { id: row.id },
            data: {
              deliveredAt: new Date(),
              attempts: { increment: 1 },
              outboundMessageId,
            },
          });
        } catch {
          await tx.inboundMessage.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              nextAttemptAt: new Date(
                Date.now() + Math.min(3600, 2 ** current.attempts * 5) * 1000,
              ),
            },
          });
          console.warn("WhatsApp response delivery deferred", {
            messageId: row.id,
          });
        }
      },
      { timeout: 25000 },
    );
    return true;
  }
  startWorker(client: WhatsAppClient) {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let running: Promise<void>;
    const tick = async () => {
      try {
        for (let i = 0; i < 25 && !stopped; i++)
          if (!(await this.processNext())) break;
        for (let i = 0; i < 25 && !stopped; i++)
          if (!(await this.deliverNext(client))) break;
      } catch {
        console.error("Accounting worker failed; will retry.");
      }
      if (!stopped)
        timer = setTimeout(() => {
          running = tick();
        }, 1000);
    };
    running = tick();
    return async () => {
      stopped = true;
      clearTimeout(timer);
      await running;
    };
  }
}
