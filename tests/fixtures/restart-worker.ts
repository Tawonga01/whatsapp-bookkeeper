import { PrismaClient } from "@prisma/client";
import { AccountingService } from "../../src/service.js";
import type { WhatsAppClient } from "../../src/whatsapp/client.js";
import { randomUUID } from "node:crypto";

const target = new URL(process.env.DATABASE_URL ?? "");
if (target.hostname !== "127.0.0.1" || target.pathname !== "/musika_test") {
  throw new Error("Restart fixture only permits the disposable local database.");
}
const db = new PrismaClient();
const service = new AccountingService(db, "USD", () => new Date("2026-10-16T12:00:00Z"));
const sender = "263770000009";
try {
  switch (process.argv[2]) {
    case "draft":
      await service.enqueue([{ id: "process-restart-draft", from: sender, text: "Chipo - Sold - Tomatoes - 5x2 - Cash 10 dollars" }]);
      while (await service.processNext()) {}
      await service.enqueue([{ id: "process-restart-confirm", from: sender, text: "Confirm" }]);
      break;
    case "save":
      await service.enqueue([{ id: "process-restart-confirm", from: sender, text: "Confirm" }]);
      while (await service.processNext()) {}
      break;
    case "deliver": {
      let acknowledgements = 0;
      const client = {
        isConfigured: () => true,
        sendResponse: async (to: string, response: {text: string}) => {
          if (to === sender && response.text === "Transaction saved.") acknowledgements++;
          return "restart-" + randomUUID();
        },
      } as unknown as WhatsAppClient;
      while (await service.deliverNext(client)) {}
      console.log(JSON.stringify({ acknowledgements }));
      break;
    }
    default: throw new Error("Unknown restart fixture phase");
  }
} finally {
  await db.$disconnect();
}
