import { test } from "node:test";
import assert from "node:assert/strict";
import { WhatsAppClient } from "../src/whatsapp/client.js";
test("outbound list, confirmation buttons and plain text match Cloud API shape", async (t) => {
  const sent: any[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(init.body as string) });
      return new Response("{}", { status: 200 });
    },
  );
  const client = new WhatsAppClient({
    accessToken: "test",
    phoneNumberId: "123",
    apiVersion: "v21.0",
  });
  await client.sendResponse("263771234567", {
    text: "Menu",
    choices: [{ id: "menu:1", title: "Cash sale" }],
  });
  await client.sendResponse("263771234567", {
    text: "Save?",
    buttons: [{ id: "confirm:abc", title: "Save" }],
  });
  await client.sendResponse("263771234567", { text: "Saved" });
  assert.equal(
    sent[0].body.interactive.action.sections[0].rows[0].id,
    "menu:1",
  );
  assert.equal(
    sent[1].body.interactive.action.buttons[0].reply.id,
    "confirm:abc",
  );
  assert.equal(sent[2].body.type, "text");
  assert.equal(sent[0].body.to, "263771234567");
});
test("missing config fails closed and provider errors do not expose private details", async (t) => {
  await assert.rejects(
    () =>
      new WhatsAppClient({}).sendResponse("263771234567", { text: "hello" }),
    /Set WHATSAPP/,
  );
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private customer data", { status: 401 }),
  );
  const client = new WhatsAppClient({
    accessToken: "test",
    phoneNumberId: "123",
    apiVersion: "v21.0",
  });
  await assert.rejects(
    () => client.sendResponse("263771234567", { text: "hello" }),
    { message: "WhatsApp send failed (HTTP 401)." },
  );
});
test("outgoing WhatsApp message ID is returned for reply-to correction lookup", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.outgoing" }] }), {
        status: 200,
      }),
  );
  const client = new WhatsAppClient({
    accessToken: "test",
    phoneNumberId: "123",
    apiVersion: "v21.0",
  });
  assert.equal(
    await client.sendResponse("263771234567", { text: "Transaction saved." }),
    "wamid.outgoing",
  );
});
