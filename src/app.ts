import { timingSafeEqual } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import {
  extractMessages,
  verifySignature,
  type IncomingMessage,
} from "./whatsapp/webhook.js";
import type { BotResponse } from "./domain/types.js";
import type { MessageContext } from "./domain/transactions.js";

export interface AppService {
  enqueue(messages: IncomingMessage[]): Promise<void>;
  simulate(
    sender: string,
    text: string,
    context?: MessageContext,
  ): Promise<BotResponse>;
  records(sender: string): Promise<unknown>;
}
export type AppConfig = {
  verifyToken?: string;
  appSecret?: string;
  phoneNumberId?: string;
  apiKey?: string;
  enableDevApi?: boolean;
  whatsappConfigured?: boolean;
};
const bodySchema = z.object({
  from: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(4096),
  replyTo: z.string().min(1).max(250).optional(),
});
export function createApp(service: AppService, config: AppConfig = {}) {
  const app = express();
  app.use(helmet());
  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "musika-accountant",
      whatsappConfigured: !!config.whatsappConfigured,
    });
  });
  app.get("/whatsapp/webhook", (req, res) => {
    if (
      config.verifyToken &&
      req.query["hub.mode"] === "subscribe" &&
      req.query["hub.verify_token"] === config.verifyToken &&
      typeof req.query["hub.challenge"] === "string"
    ) {
      res.status(200).type("text/plain").send(req.query["hub.challenge"]);
      return;
    }
    res.sendStatus(403);
  });
  app.post(
    "/whatsapp/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res, next) => {
      if (!config.appSecret || !config.phoneNumberId) {
        res.sendStatus(503);
        return;
      }
      if (
        !Buffer.isBuffer(req.body) ||
        !verifySignature(
          req.body,
          req.get("x-hub-signature-256"),
          config.appSecret,
        )
      ) {
        res.sendStatus(401);
        return;
      }
      try {
        const messages = extractMessages(
          JSON.parse(req.body.toString("utf8")),
          config.phoneNumberId,
        );
        await service.enqueue(messages); // Acknowledge only after durable receipt.
        res.sendStatus(200);
      } catch (error) {
        next(error);
      }
    },
  );
  if (config.enableDevApi) {
    const auth: express.RequestHandler = (req, res, next) => {
      const supplied = Buffer.from(req.get("authorization") ?? "");
      const expected = Buffer.from("Bearer " + (config.apiKey ?? ""));
      if (
        !config.apiKey ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        res.sendStatus(401);
        return;
      }
      next();
    };
    app.post(
      "/simulate",
      auth,
      express.json({ limit: "16kb" }),
      async (req, res, next) => {
        try {
          const b = bodySchema.parse(req.body);
          res.json(
            await service.simulate("sim:" + b.from, b.text, {
              replyTo: b.replyTo,
            }),
          );
        } catch (error) {
          next(error);
        }
      },
    );
    app.get("/records", auth, async (req, res, next) => {
      try {
        const sender = z.string().min(1).max(120).parse(req.query.sender);
        res.json(await service.records(sender));
      } catch (error) {
        next(error);
      }
    });
  }
  app.use((_req, res) => {
    res.sendStatus(404);
  });
  const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid request body or parameters." });
      return;
    }
    if (error?.type === "entity.too.large") {
      res.sendStatus(413);
      return;
    }
    console.error("Request could not be processed.");
    res.status(500).json({ error: "Could not process request. Please retry." });
  };
  app.use(errors);
  return app;
}
