import { test } from "node:test";
import assert from "node:assert/strict";
import { BookkeepingBot, type LedgerStore } from "../src/domain/bot.js";
import { dueDate, localDay } from "../src/domain/dates.js";
import {
  amount,
  parseTransaction,
  replay,
  type ChatState,
  type Correction,
  type LedgerEvent,
  type Transaction,
} from "../src/domain/transactions.js";

const now = new Date("2026-10-16T12:00:00Z");
class MemoryStore implements LedgerStore {
  state: ChatState | null = null;
  entries: LedgerEvent[] = [];
  revisions: LedgerEvent[] = [];
  async getState() {
    return structuredClone(this.state);
  }
  async setState(state: ChatState | null) {
    this.state = structuredClone(state);
  }
  async events() {
    return structuredClone(this.entries);
  }
  async resolveReply(reference: string) {
    return structuredClone(
      this.entries.find(
        (e) => e.id === reference || e.sourceMessageId === reference,
      ) ?? null,
    );
  }
  async save(
    data: Transaction,
    id: string,
    sourceMessageId?: string,
    correction?: Correction,
  ) {
    if (correction) {
      const old = this.entries.find((e) => e.id === id)!;
      this.revisions.push(structuredClone(old));
      old.data = structuredClone(data);
      old.revision++;
      return structuredClone(old);
    }
    const event = {
      id,
      data: structuredClone(data),
      revision: 1,
      currency: "USD",
      createdAt: now.toISOString(),
      sourceMessageId,
    };
    this.entries.push(event);
    return structuredClone(event);
  }
}
function setup() {
  const store = new MemoryStore();
  let instant = now;
  let counter = 0;
  const bot = new BookkeepingBot(store, "USD", () => instant);
  return {
    store,
    bot,
    send: (text: string, replyTo?: string) =>
      bot.handleMessage("vendor", text, {
        messageId: "m" + ++counter,
        replyTo,
      }),
    account: () => replay(store.entries).accounts.get("makoni"),
    advance: () => {
      instant = new Date(instant.getTime() + 31 * 60_000);
    },
  };
}
test("the accepted Makoni walkthrough: corrected drafts, dates, repayment and full handbacks", async () => {
  const { send, store, account } = setup();
  let r = await send("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars");
  assert.match(r.text, /CHIKWERETI: \*\$4.20\*/);
  assert.deepEqual(
    r.buttons!.map((b) => b.title),
    ["Enter date", "Skip"],
  );
  await send("Sunday");
  assert.equal(store.entries.length, 0);
  assert.equal(
    (await send("Correct")).text,
    "Please enter the transaction again with the correct details.",
  );
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars");
  r = await send("sunday");
  assert.match(r.text, /Sunday, 18 October 2026/);
  assert.match(r.text, /Cash received: \$7.00/);
  assert.equal((await send("confirm")).text, "Transaction saved.");
  assert.equal(account()!.chikwereti, 320);
  assert.equal(store.entries.length, 1);
  await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
  r = await send("skip");
  assert.match(r.text, /\$6.20/);
  assert.match(r.text, /18 October 2026/);
  await send("confirm");
  r = await send("Makoni - Paid - 10 dollars");
  assert.equal(r.text, "*$3.80 CHANGE*\nDid you give it back?");
  r = await send("NO");
  assert.match(r.text, /CHANGE: \*\$3.80\*/);
  await send("correct");
  await send("Makoni - Paid - 10 dollars");
  r = await send("yes");
  assert.equal(
    r.text,
    "Makoni — Payment\nCash received: $10.00\nCHANGE: *$0.00*\n\nSave this transaction?",
  );
  await send("confirm");
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars");
  r = await send("yes");
  assert.equal(
    r.text,
    "Makoni — Soap\n6 × $1.70 = $10.20\nCash received: $15.00\nCHANGE: *$0.00*\n\nSave this transaction?",
  );
  await send("comfirm");
  assert.equal(store.entries.length, 4);
  assert.equal(account()!.chikwereti, 0);
  assert.equal(account()!.change, 0);
  const sums = store.entries.reduce(
    (a, e) => ({
      sale: a.sale + (e.data.action === "sold" ? e.data.total : 0),
      received: a.received + e.data.cashReceived!,
      returned: a.returned + e.data.cashReturned,
    }),
    { sale: 0, received: 0, returned: 0 },
  );
  assert.deepEqual(sums, { sale: 2340, received: 3200, returned: 860 });
});
test("missing cash is asked for explicitly, zero cash is valid, absent first due date can be skipped", async () => {
  const { send, store, account } = setup();
  assert.equal(
    (await send("Makoni - Sold - Nails - 5x2 - Cash")).text,
    "How much cash did you receive?",
  );
  await send("0 dollars");
  const r = await send("Skip");
  assert.match(r.text, /Due: \*Not specified\*/);
  assert.equal(store.entries.length, 0);
  await send("Confirm");
  assert.equal(account()!.chikwereti, 1000);
  assert.equal(account()!.dueDate, undefined);
});
test("new due-date answer replaces customer date, Skip and later repayments retain it", async () => {
  const { send, account } = setup();
  await send("Makoni - Sold - Nails - 5x2 - Cash 0 dollars");
  await send("Sunday");
  await send("Confirm");
  await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
  await send("Monday");
  await send("Confirm");
  assert.equal(account()!.dueDate, "2026-10-19");
  const payment = await send("Makoni - Paid - 3 dollars");
  assert.match(payment.text, /19 October 2026/);
  await send("Confirm");
  assert.equal(account()!.dueDate, "2026-10-19");
});
test("full or none handback, CHANGE use and full later return", async () => {
  const { send, account, store } = setup();
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars");
  await send("No");
  await send("Confirm");
  assert.equal(account()!.change, 480);
  let r = await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
  assert.equal(
    r.text,
    "Makoni has $4.80 CHANGE.\nUse $3.00 to pay for this sale?",
  );
  r = await send("Yes");
  assert.match(r.text, /CHANGE used: \$3.00/);
  assert.match(r.text, /CHANGE: \*\$1.80\*/);
  await send("Confirm");
  r = await send("Makoni - Returned - 1 dollars");
  assert.match(r.text, /partial handbacks are not supported/);
  assert.equal(store.entries.length, 2);
  assert.equal(account()!.change, 180);
  r = await send("Makoni - Returned - 1.80 dollars");
  assert.match(r.text, /Cash returned: \$1.80/);
  await send("Confirm");
  assert.equal(account()!.change, 0);
});
test("No to CHANGE use rejects interpretation; it cannot create simultaneous CHANGE and CHIKWERETI", async () => {
  const { send, account, store } = setup();
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars");
  await send("No");
  await send("Confirm");
  await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
  assert.match((await send("No")).text, /enter the transaction again/);
  await send("Confirm");
  assert.equal(store.entries.length, 1);
  assert.equal(account()!.change, 480);
  assert.equal(account()!.chikwereti, 0);
});
test("mixed cash and insufficient CHANGE ask the residual CHIKWERETI date", async () => {
  const { send, account } = setup();
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars");
  await send("No");
  await send("Confirm");
  await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
  await send("Yes");
  await send("Confirm");
  const q = await send("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars");
  assert.match(q.text, /leaving \$2.40 CHIKWERETI/);
  assert.equal(
    (await send("Yes")).text,
    "When will Makoni pay?\nCHIKWERETI: *$2.40*",
  );
  await send("Skip");
  await send("Confirm");
  assert.equal(account()!.change, 0);
  assert.equal(account()!.chikwereti, 240);
});
test("later payments settle earliest credit; cash with a sale settles that sale first", async () => {
  const { send, account, store } = setup();
  for (const msg of [
    "Makoni - Sold - Old - 1x5 - Cash 0 dollars",
    "Makoni - Sold - Nails - 1x2 - Cash 0 dollars",
    "Makoni - Sold - Nails - 1x2 - Cash 0 dollars",
  ]) {
    await send(msg);
    await send("Skip");
    await send("Confirm");
  }
  await send("Makoni - Paid - 3 dollars");
  await send("Confirm");
  assert.deepEqual(
    account()!.credits.map((c) => c.remaining),
    [200, 200, 200],
  );
  await send("Makoni - Sold - Sweets - 3x1 - Cash 5 dollars");
  await send("Confirm");
  assert.deepEqual(
    account()!.credits.map((c) => c.remaining),
    [0, 200, 200],
  );
  assert.equal(store.entries.length, 5);
});
test("new sale clears old debt before excess handback", async () => {
  const { send, account } = setup();
  await send("Makoni - Sold - Old - 1x8 - Cash 0 dollars");
  await send("Skip");
  await send("Confirm");
  assert.equal(
    (await send("Makoni - Sold - Sweets - 3x1 - Cash 15 dollars")).text,
    "*$4.00 CHANGE*\nDid you give it back?",
  );
  await send("No");
  await send("Confirm");
  assert.equal(account()!.change, 400);
  assert.equal(account()!.chikwereti, 0);
});
test("Cancel exact acknowledgement, expired drafts, stale buttons and duplicate Confirm do not save", async () => {
  const { send, store, advance } = setup();
  let r = await send("Makoni - Sold - Nails - 5x2 - Cash 10 dollars");
  const stale = r.buttons![0].id;
  assert.equal((await send("Cancel")).text, "Transaction cancelled.");
  await send("Makoni - Sold - Nails - 5x2 - Cash 10 dollars");
  assert.match((await send(stale)).text, /older step/);
  assert.equal(store.entries.length, 0);
  r = await send("Confirm");
  assert.equal(r.text, "Transaction saved.");
  await send("Confirm");
  assert.equal(store.entries.length, 1);
  await send("Makoni - Sold - Nails - 5x2 - Cash 0 dollars");
  advance();
  assert.match((await send("Sunday")).text, /expired/);
  assert.equal(store.entries.length, 1);
});
test("Enter date is clickable and a Yes answer on final confirmation cannot save", async () => {
  const { send, store } = setup();
  const q = await send("Makoni - Sold - Nails - 5x2 - Cash 0 dollars");
  await send(q.buttons![0].id);
  const staleSkip = q.buttons![1].id;
  assert.match((await send(staleSkip)).text, /older step/);
  await send("Next Friday");
  await send("Yes");
  assert.equal(store.entries.length, 0);
  await send("Confirm");
  assert.equal(store.entries.length, 1);
});
test("reply Correct replaces one saved entry, retains audit history and Cancel retains original", async () => {
  const { send, store, account } = setup();
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars");
  await send("Sunday");
  await send("Confirm");
  const original = store.entries[0];
  await send("Correct", original.sourceMessageId);
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars");
  await send("Skip");
  assert.equal(account()!.chikwereti, 320);
  assert.equal((await send("Confirm")).text, "Transaction corrected.");
  assert.equal(account()!.chikwereti, 420);
  assert.equal(account()!.dueDate, "2026-10-18");
  assert.equal(store.entries.length, 1);
  assert.equal(store.revisions.length, 1);
  assert.equal(store.entries[0].revision, 2);
  await send("Correct", original.id);
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 5 dollars");
  await send("Skip");
  await send("Cancel");
  assert.equal(account()!.chikwereti, 420);
  assert.equal(store.revisions.length, 1);
});
test("older corrections with dependent customer activity are blocked, never silently replayed", async () => {
  const { send, store } = setup();
  await send("Makoni - Sold - Nails - 5x2 - Cash 0 dollars");
  await send("Skip");
  await send("Confirm");
  const id = store.entries[0].id;
  await send("Makoni - Paid - 2 dollars");
  await send("Confirm");
  assert.match((await send("Correct", id)).text, /later customer activity/);
  assert.equal(store.revisions.length, 0);
});
test("money validation, unit-price arithmetic and Harare calendar boundaries", () => {
  for (const v of ["-1", "1.001", "NaN", "Infinity", "10000000000"]) {
    assert.throws(() => amount(v));
  }
  assert.equal(amount("0 dollars", true), 0);
  assert.equal(amount("1.01"), 101);
  assert.throws(() => amount("0"));
  assert.equal(
    parseTransaction("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars")!.total,
    1020,
  );
  assert.equal(dueDate("Friday", now), "2026-10-23");
  assert.equal(dueDate("Next Friday", now), "2026-10-23");
  assert.equal(dueDate("today", now), "2026-10-16");
  assert.equal(dueDate("Sunday", now), "2026-10-18");
  assert.equal(localDay(new Date("2026-10-16T22:30:00Z")), "2026-10-17");
  assert.throws(() => dueDate("2026-02-30", now));
});
test("sale descriptions on a later payment never override earliest-credit allocation", async () => {
  const { send, store, account } = setup();
  for (const message of [
    "Makoni - Sold - Old - 1x5 - Cash 0 dollars",
    "Makoni - Sold - Nails - 1x2 - Cash 0 dollars",
    "Makoni - Sold - Nails - 1x2 - Cash 0 dollars",
  ]) {
    await send(message);
    await send("Skip");
    await send("Confirm");
  }
  await send("Makoni - Paid - 3 dollars - Sale 19 July - Nails - Qty 1");
  await send("Confirm");
  assert.deepEqual(
    account()!.credits.map((c) => c.remaining),
    [200, 200, 200],
  );
  assert.equal(store.entries.at(-1)!.data.note, "Sale 19 July - Nails - Qty 1");
});
test("expense and daily cash reporting do not count debt payments as additional sales", async () => {
  const { send } = setup();
  await send("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars");
  await send("Skip");
  await send("Confirm");
  await send("Makoni - Paid - 5 dollars");
  await send("Yes");
  await send("Confirm");
  await send("expense transport 2 dollars");
  await send("Confirm");
  const report = await send("Summary");
  assert.match(report.text, /Sales: \$10.20/);
  assert.match(report.text, /Cash received: \$11.00/);
  assert.match(report.text, /Cash returned: \$0.80/);
  assert.match(report.text, /Cash movement: \$8.20/);
});
