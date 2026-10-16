import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./db/prisma.js";
import { AccountingService } from "./service.js";
import { createWhatsAppClientFromEnv } from "./whatsapp/client.js";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid port number.");
const currency = process.env.BOOKKEEPING_CURRENCY ?? "USD";
if (!/^[A-Z]{3}$/.test(currency)) throw new Error("BOOKKEEPING_CURRENCY must be a three-letter code. Use one currency for this pilot.");
const enableDevApi = process.env.ENABLE_DEV_API === "true";
if (enableDevApi && (!process.env.DEV_API_KEY || process.env.DEV_API_KEY.length < 24)) throw new Error("Development API requires a random DEV_API_KEY of at least 24 characters.");
if (enableDevApi && process.env.NODE_ENV === "production") throw new Error("Disable ENABLE_DEV_API in production.");
const client = createWhatsAppClientFromEnv();
const configured = client.isConfigured() && Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN);
if (process.env.NODE_ENV === "production" && !configured) throw new Error("Complete WhatsApp environment configuration before production startup.");
const service = new AccountingService(prisma,currency);
await prisma.$connect();
const stopWorker = service.startWorker(client);
const server = createApp(service,{
  verifyToken:process.env.WHATSAPP_VERIFY_TOKEN,appSecret:process.env.WHATSAPP_APP_SECRET,
  phoneNumberId:process.env.WHATSAPP_PHONE_NUMBER_ID,apiKey:process.env.DEV_API_KEY,
  enableDevApi,whatsappConfigured:configured,
}).listen(port,enableDevApi ? "127.0.0.1" : (process.env.HOST ?? "0.0.0.0"),()=>{
  console.log(`MUSIKA ACCOUNTANT listening on port ${port}. WhatsApp configured: ${configured}.`);
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await stopWorker();
  await prisma.$disconnect();
}
process.on("SIGINT",()=>void shutdown());
process.on("SIGTERM",()=>void shutdown());
