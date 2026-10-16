import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp, type AppConfig, type AppService } from "../src/app.js";
import { extractMessages } from "../src/whatsapp/webhook.js";

const config: AppConfig = {
  appSecret: "test-secret",
  verifyToken: "test-verify",
  phoneNumberId: "123",
  enableDevApi: true,
  apiKey: "test-key",
};
const payload = (messages: unknown[] = []) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: { metadata: { phone_number_id: "123" }, messages },
        },
      ],
    },
  ],
});
async function serve(
  t: any,
  overrides: Partial<AppService> = {},
  cfg = config,
) {
  const calls: any[] = [];
  const server = createApp(
    {
      enqueue: async (m) => {
        calls.push(m);
      },
      simulate: async (from, text) => ({ text: from + ":" + text }),
      records: async (s) => ({ sender: s }),
      ...overrides,
    },
    cfg,
  ).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls,
  };
}
function signed(body: string) {
  return {
    "content-type": "application/json",
    "x-hub-signature-256":
      "sha256=" +
      createHmac("sha256", "test-secret").update(body).digest("hex"),
  };
}
test("verification challenge and missing/wrong token fail closed", async (t) => {
  const { url } = await serve(t);
  assert.equal(
    (
      await fetch(
        url +
          "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=42",
      )
    ).status,
    403,
  );
  const res = await fetch(
    url +
      "/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=42",
  );
  assert.equal(await res.text(), "42");
});
test("signed webhook is queued, unsigned or tampered payloads rejected", async (t) => {
  const { url, calls } = await serve(t);
  const body = JSON.stringify(
    payload([
      { id: "m1", from: "263771234567", type: "text", text: { body: "MENU" } },
    ]),
  );
  assert.equal(
    (
      await fetch(url + "/whatsapp/webhook", {
        method: "POST",
        body,
        headers: signed(body),
      })
    ).status,
    200,
  );
  assert.deepEqual(calls[0], [
    { id: "m1", from: "263771234567", text: "MENU" },
  ]);
  assert.equal(
    (
      await fetch(url + "/whatsapp/webhook", {
        method: "POST",
        body: body + " ",
        headers: signed(body),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(url + "/whatsapp/webhook", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      })
    ).status,
    401,
  );
  assert.equal(calls.length, 1);
});
test("unconfigured webhook rejects traffic; queue failure is not acknowledged", async (t) => {
  const a = await serve(t, {}, {});
  const b = await serve(t, {
    enqueue: async () => {
      throw Error("db unavailable");
    },
  });
  const body = JSON.stringify(payload());
  assert.equal(
    (
      await fetch(a.url + "/whatsapp/webhook", {
        method: "POST",
        body,
        headers: signed(body),
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await fetch(b.url + "/whatsapp/webhook", {
        method: "POST",
        body,
        headers: signed(body),
      })
    ).status,
    500,
  );
});
test("list/button replies use IDs; status events and other phone numbers are ignored", () => {
  const p = payload([
    {
      id: "m2",
      from: "263771234567",
      type: "interactive",
      interactive: { type: "list_reply", list_reply: { id: "menu:1" } },
    },
  ]);
  assert.equal(extractMessages(p, "123")[0].text, "menu:1");
  assert.deepEqual(extractMessages(p, "other"), []);
  const b = payload([
    {
      id: "m3",
      from: "263771234567",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: "confirm:token" },
      },
    },
  ]);
  assert.equal(extractMessages(b, "123")[0].text, "confirm:token");
  assert.deepEqual(extractMessages(payload(), "123"), []);
});
test("development API needs authentication, explicit sender and separate simulator identity", async (t) => {
  const { url } = await serve(t);
  assert.equal((await fetch(url + "/records?sender=vendor")).status, 401);
  const headers = {
    authorization: "Bearer test-key",
    "content-type": "application/json",
  };
  assert.equal((await fetch(url + "/records", { headers })).status, 400);
  assert.deepEqual(
    await (
      await fetch(url + "/simulate", {
        method: "POST",
        headers,
        body: JSON.stringify({ from: "vendor", text: "MENU" }),
      })
    ).json(),
    { text: "sim:vendor:MENU" },
  );
  const disabled = await serve(t, {}, {});
  assert.equal(
    (await fetch(disabled.url + "/records?sender=vendor", { headers })).status,
    404,
  );
});
test("reply context survives signed webhook extraction and authenticated simulation", async (t) => {
  const p = payload([
    {
      id: "reply1",
      from: "263771234567",
      type: "text",
      text: { body: "Correct" },
      context: { id: "original-wamid" },
    },
  ]);
  assert.equal(extractMessages(p, "123")[0].replyTo, "original-wamid");
  let context: unknown;
  const { url } = await serve(t, {
    simulate: async (_sender, _text, c) => {
      context = c;
      return { text: "ok" };
    },
  });
  await fetch(url + "/simulate", {
    method: "POST",
    headers: {
      authorization: "Bearer test-key",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "vendor",
      text: "Correct",
      replyTo: "original-wamid",
    }),
  });
  assert.deepEqual(context, { replyTo: "original-wamid" });
});
