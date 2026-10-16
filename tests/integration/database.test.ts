import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";
import { execFileSync } from "node:child_process";
import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { AccountingService } from "../../src/service.js";
import type { WhatsAppClient } from "../../src/whatsapp/client.js";

test(
  "PostgreSQL upgrade, accepted conversations, receipt atomicity, corrections and isolation",
  { timeout: 120_000 },
  async (t) => {
    const probe = createServer();
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((r) => probe.close(() => r()));
    const directory = await mkdtemp(join(tmpdir(), "musika-db-test-"));
    const password = randomBytes(24).toString("hex");
    assert.ok(
      resolve(directory).startsWith(
        resolve(tmpdir()) + sep + "musika-db-test-",
      ),
    );
    const pg = new EmbeddedPostgres({
      databaseDir: join(directory, "db"),
      user: "postgres",
      password,
      port,
      persistent: true,
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/musika_test?schema=public`;
    const db = new PrismaClient({ datasources: { db: { url } } });
    const service = new AccountingService(
      db,
      "USD",
      () => new Date("2026-10-16T12:00:00Z"),
    );
    const cli = (...args: string[]) =>
      execFileSync(
        process.execPath,
        ["node_modules/prisma/build/index.js", ...args],
        {
          env: { ...process.env, DATABASE_URL: url },
          stdio: "pipe",
          windowsHide: true,
        },
      );
    let started = false;
    try {
      await pg.initialise();
      await pg.start();
      started = true;
      await pg.createDatabase("musika_test");
      // Start on the prior schema and insert real legacy records before the additive upgrade.
      cli(
        "db",
        "push",
        "--schema",
        "tests/fixtures/legacy-schema.prisma",
        "--skip-generate",
      );
      const shop = await db.shop.create({
        data: { name: "Legacy vendor", phoneNumber: "263770000001" },
      });
      const customer = await db.customer.create({
        data: { shopId: shop.id, name: "Makoni", normalizedName: "makoni" },
      });
      const item = await db.item.create({
        data: { shopId: shop.id, name: "Nails", normalizedName: "nails" },
      });
      await db.sale.create({
        data: {
          shopId: shop.id,
          customerId: customer.id,
          itemId: item.id,
          quantity: 1,
          amount: 10,
          kind: "credit",
          dueDateText: "2026-10-18",
        },
      });
      await db.payment.create({
        data: { shopId: shop.id, customerId: customer.id, amount: 2 },
      });
      cli(
        "db",
        "execute",
        "--file",
        "prisma/updates/20261016_transaction_ledger.sql",
        "--schema",
        "prisma/schema.prisma",
      );

      await t.test(
        "additive upgrade retains legacy records and their customer balances",
        async () => {
          assert.equal(await db.sale.count(), 1);
          assert.equal(await db.payment.count(), 1);
          assert.equal(await db.ledgerEntry.count(), 0);
          const records = await service.records("263770000001");
          assert.equal(records.accounts[0].chikwereti, 8);
          assert.equal(records.accounts[0].dueDate, "2026-10-18");
          await service.simulate("263770000001", "Makoni - Paid - 3 dollars");
          await service.simulate("263770000001", "Confirm");
          assert.equal(
            (await service.records("263770000001")).accounts[0].chikwereti,
            5,
          );
          assert.equal(await db.sale.count(), 1);
          assert.equal(await db.payment.count(), 1);
        },
      );
      await t.test(
        "accepted Makoni walkthrough runs against PostgreSQL and survives a service restart",
        async () => {
          const sender = "263770000002";
          let bot = service;
          const send = (text: string) => bot.simulate(sender, text);
          await send("Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars");
          await send("Sunday");
          await send("Correct");
          await send("Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars");
          await send("Sunday");
          bot = new AccountingService(
            db,
            "USD",
            () => new Date("2026-10-16T12:00:00Z"),
          );
          await send("Confirm");
          await send("Makoni - Sold - Sweets - 3x1 - Cash 0 dollars");
          assert.match((await send("Skip")).text, /18 October 2026/);
          await send("Confirm");
          await send("Makoni - Paid - 10 dollars");
          await send("No");
          await send("Correct");
          await send("Makoni - Paid - 10 dollars");
          await send("Yes");
          await send("Confirm");
          await send("Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars");
          await send("Yes");
          await send("comfirm");
          const records = await service.records(sender);
          assert.equal(records.transactions.length, 4);
          assert.equal(records.sales.length, 3);
          assert.equal(records.payments.length, 1);
          assert.equal(records.accounts[0].chikwereti, 0);
          assert.equal(records.accounts[0].change, 0);
          assert.equal(
            records.transactions.reduce(
              (n, e) => n + (e.data.cashReceived ?? 0) - e.data.cashReturned,
              0,
            ),
            2340,
          );
        },
      );
      await t.test(
        "duplicate webhook receipts and concurrent confirmations create only one entry",
        async () => {
          const sender = "263770000003";
          await service.enqueue([
            {
              id: "duplicate-draft",
              from: sender,
              text: "Makoni - Sold - Nails - 5x2 - Cash 10 dollars",
            },
          ]);
          await service.processNext();
          const restarted = new AccountingService(
            db,
            "USD",
            () => new Date("2026-10-16T12:00:00Z"),
          );
          await Promise.all([
            service.enqueue([
              { id: "duplicate-confirm", from: sender, text: "Confirm" },
            ]),
            restarted.enqueue([
              { id: "duplicate-confirm", from: sender, text: "Confirm" },
            ]),
          ]);
          await Promise.all([service.processNext(), restarted.processNext()]);
          await service.enqueue([
            { id: "another-confirm", from: sender, text: "Confirm" },
          ]);
          await service.processNext();
          assert.equal(
            (await service.records(sender)).transactions.length,
            1,
            JSON.stringify(
              await db.inboundMessage.findMany({
                where: { senderId: sender },
                select: { id: true, response: true },
              }),
            ),
          );
          assert.equal(
            await db.inboundMessage.count({
              where: { id: "duplicate-confirm" },
            }),
            1,
          );
          assert.equal(
            (await service.records("263770000004")).transactions.length,
            0,
          );
        },
      );
      await t.test(
        "ledger, conversation and response roll back together on database failure",
        async () => {
          const sender = "263770000005";
          await service.enqueue([
            {
              id: "rollback-draft",
              from: sender,
              text: "Makoni - Sold - Nails - 5x2 - Cash 10 dollars",
            },
          ]);
          await service.processNext();
          await service.enqueue([
            { id: "rollback-confirm", from: sender, text: "Confirm" },
          ]);
          await db.$executeRawUnsafe(
            `CREATE FUNCTION fail_receipt() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test receipt failure'; END; $$ LANGUAGE plpgsql`,
          );
          await db.$executeRawUnsafe(
            `CREATE TRIGGER fail_receipt BEFORE UPDATE OF response ON "InboundMessage" FOR EACH ROW WHEN (NEW.id = 'rollback-confirm') EXECUTE FUNCTION fail_receipt()`,
          );
          await assert.rejects(() => service.processNext());
          assert.equal((await service.records(sender)).transactions.length, 0);
          assert.equal(
            await db.conversation.count({ where: { senderId: sender } }),
            1,
          );
          assert.equal(
            (
              await db.inboundMessage.findUniqueOrThrow({
                where: { id: "rollback-confirm" },
              })
            ).response,
            null,
          );
          await db.$executeRawUnsafe(
            `DROP TRIGGER fail_receipt ON "InboundMessage"`,
          );
          await db.$executeRawUnsafe(`DROP FUNCTION fail_receipt()`);
          await service.processNext();
          assert.equal((await service.records(sender)).transactions.length, 1);
        },
      );
      await t.test(
        "saved correction via original-message reply creates one audited revision, never another sale",
        async () => {
          const sender = "263770000006";
          await service.enqueue([
            {
              id: "original-sale",
              from: sender,
              text: "Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars",
            },
            { id: "original-date", from: sender, text: "Sunday" },
            { id: "original-confirm", from: sender, text: "Confirm" },
          ]);
          while (await service.processNext()) {}
          const first = (await service.records(sender)).transactions[0];
          const denied = await service.simulate("263770000007", "Correct", {
            replyTo: "original-sale",
          });
          assert.match(denied.text, /reply to the original/);
          await service.enqueue([
            {
              id: "correction-request",
              from: sender,
              text: "Correct",
              replyTo: "original-sale",
            },
            {
              id: "replacement-sale",
              from: sender,
              text: "Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars",
            },
            { id: "replacement-date", from: sender, text: "Skip" },
            { id: "replacement-confirm", from: sender, text: "Confirm" },
          ]);
          while (await service.processNext()) {}
          const records = await service.records(sender);
          assert.equal(records.transactions.length, 1);
          assert.equal(records.transactions[0].id, first.id);
          assert.equal(records.transactions[0].revision, 2);
          assert.equal(records.accounts[0].chikwereti, 4.2);
          assert.equal(records.accounts[0].dueDate, "2026-10-18");
          const revision = await db.ledgerRevision.findFirstOrThrow({
            where: { entryId: first.id },
          });
          assert.equal((revision.previous as any).cashReceived, 700);
          assert.equal((revision.replacement as any).cashReceived, 600);
          await service.simulate(sender, "Correct", {
            replyTo: "replacement-sale",
          });
          await service.simulate(sender, "Cancel");
          assert.equal(
            (await service.records(sender)).transactions[0].revision,
            2,
          );
          await service.simulate(sender, "Makoni - Paid - 1 dollars");
          await service.simulate(sender, "Confirm");
          assert.match(
            (
              await service.simulate(sender, "Correct", {
                replyTo: "original-sale",
              })
            ).text,
            /later customer activity/,
          );
        },
      );
      await t.test(
        "reply-to outgoing confirmation is linked to the saved transaction; delivery retries do not rerun accounting",
        async () => {
          let count = 0,
            fail = true;
          const client = {
            isConfigured: () => true,
            sendResponse: async () => {
              if (fail) throw Error("temporary");
              return "bot-" + ++count;
            },
          } as unknown as WhatsAppClient;
          await service.deliverNext(client);
          const first = await db.inboundMessage.findFirstOrThrow({
            where: { attempts: 1, deliveredAt: null },
          });
          assert.equal(first.response !== null, true);
          await db.inboundMessage.update({
            where: { id: first.id },
            data: { nextAttemptAt: new Date(0) },
          });
          fail = false;
          const before = await db.ledgerEntry.count();
          await Promise.all([
            service.deliverNext(client),
            new AccountingService(db).deliverNext(client),
          ]);
          assert.equal(count, 1);
          while (await service.deliverNext(client)) {}
          assert.equal(await db.ledgerEntry.count(), before);
          const saved = await db.inboundMessage.findUniqueOrThrow({
            where: { id: "duplicate-draft" },
          });
          assert.ok(saved.outboundMessageId);
          const response = await service.simulate("263770000003", "Correct", {
            replyTo: saved.outboundMessageId!,
          });
          assert.equal(
            response.text,
            "Please enter the transaction again with the correct details.",
          );
          await service.simulate("263770000003", "Cancel");
        },
      );
      await t.test(
        "queued relative dates use receipt time even after a later worker restart",
        async () => {
          const sender = "263770000008";
          await service.enqueue([
            {
              id: "dated-sale",
              from: sender,
              text: "Makoni - Sold - Nails - 5x2 - Cash 0 dollars",
            },
            { id: "dated-answer", from: sender, text: "Friday" },
            { id: "dated-confirm", from: sender, text: "Confirm" },
          ]);
          for (const [index, id] of [
            "dated-sale",
            "dated-answer",
            "dated-confirm",
          ].entries())
            await db.inboundMessage.update({
              where: { id },
              data: { createdAt: new Date(`2026-10-16T12:00:0${index}Z`) },
            });
          const worker = new AccountingService(db);
          while (await worker.processNext()) {}
          assert.equal(
            (await service.records(sender)).accounts[0].dueDate,
            "2026-10-23",
          );
        },
      );
      await t.test("separate processes and a PostgreSQL restart recover queued confirmation and unsent acknowledgement exactly once", async () => {
        const child = (phase: string) => execFileSync(process.execPath,
          ["--import", "tsx", "tests/fixtures/restart-worker.ts", phase],
          { env: { ...process.env, DATABASE_URL: url }, encoding: "utf8", windowsHide: true });
        child("draft");
        const receipt = await db.inboundMessage.findUniqueOrThrow({ where: { id: "process-restart-confirm" } });
        assert.equal(receipt.response, null);
        await db.$disconnect();
        await pg.stop();
        started = false;
        await pg.start();
        started = true;
        await db.$connect();
        child("save");
        const afterSave = await db.inboundMessage.findUniqueOrThrow({ where: { id: "process-restart-confirm" } });
        assert.equal((afterSave.response as any).text, "Transaction saved.");
        assert.equal(afterSave.deliveredAt, null);
        assert.equal((await service.records("263770000009")).transactions.length, 1);
        assert.equal(JSON.parse(child("deliver")).acknowledgements, 1);
        child("save");
        assert.equal(JSON.parse(child("deliver")).acknowledgements, 0);
        assert.equal((await service.records("263770000009")).transactions.length, 1);
      });
    } finally {
      await db.$disconnect();
      if (started) await pg.stop();
      // This exact temporary directory was created above. Retry Windows file-lock release after shutdown.
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    }
  },
);
