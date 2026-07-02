import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { prisma } from "./db/prisma.js";
import { BookkeepingBot } from "./domain/bot.js";
import { BookkeepingStore } from "./domain/store.js";

const simulateBodySchema = z.object({
  from: z.string().min(1),
  text: z.string().min(1),
});

const store = new BookkeepingStore(prisma);
const bot = new BookkeepingBot(store);

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "whatsapp-bookkeeper" });
  });

  app.post("/simulate", async (request, response, next) => {
    try {
      const body = simulateBodySchema.parse(request.body);
      const result = await bot.handleMessage(body.from, body.text);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/whatsapp/webhook", (request, response) => {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      response.status(200).send(challenge);
      return;
    }

    response.sendStatus(403);
  });

  app.post("/whatsapp/webhook", async (request, response, next) => {
    try {
      const messages = extractWhatsAppMessages(request.body);

      for (const message of messages) {
        const result = await bot.handleMessage(message.from, message.text);
        console.log("WhatsApp reply pending", { to: message.from, text: result.text });
      }

      response.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  app.get("/records", async (_request, response, next) => {
    try {
      const [sales, payments, debtors, summary] = await Promise.all([
        store.listSales(),
        store.listPayments(),
        store.debtorBalances(),
        store.summary(),
      ]);

      response.json({ sales, payments, debtors, summary });
    } catch (error) {
      next(error);
    }
  });

  return app;
}

function extractWhatsAppMessages(payload: unknown): Array<{ from: string; text: string }> {
  const value = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  return (value.entry ?? [])
    .flatMap((entry) => entry.changes ?? [])
    .flatMap((change) => change.value?.messages ?? [])
    .filter((message) => message.from && message.text?.body)
    .map((message) => ({ from: message.from!, text: message.text!.body! }));
}
