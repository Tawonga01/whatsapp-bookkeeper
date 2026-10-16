import { Prisma } from "@prisma/client";
import { dueDate } from "./dates.js";
import type { LedgerStore } from "./bot.js";
import {
  correctionAllowed,
  replay,
  TransactionError,
  type ChatState,
  type Correction,
  type LedgerEvent,
  type Transaction,
} from "./transactions.js";

export class BookkeepingStore implements LedgerStore {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly sender: string,
    private readonly currency = "USD",
  ) {}
  private shop() {
    return this.db.shop.upsert({
      where: { phoneNumber: this.sender },
      create: { name: "WhatsApp " + this.sender, phoneNumber: this.sender },
      update: {},
    });
  }
  async getState(): Promise<ChatState | null> {
    const row = await this.db.conversation.findUnique({
      where: { senderId: this.sender },
    });
    return (row?.state as unknown as ChatState) ?? null;
  }
  async setState(state: ChatState | null) {
    if (!state) {
      await this.db.conversation.deleteMany({
        where: { senderId: this.sender },
      });
      return;
    }
    const json = JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
    await this.db.conversation.upsert({
      where: { senderId: this.sender },
      create: { senderId: this.sender, state: json },
      update: { state: json },
    });
  }
  async events(): Promise<LedgerEvent[]> {
    const shop = await this.shop();
    const where = { shopId: shop.id };
    const [sales, payments, expenses, entries] = await Promise.all([
      this.db.sale.findMany({ where, include: { item: true, customer: true } }),
      this.db.payment.findMany({ where, include: { customer: true } }),
      this.db.expense.findMany({ where }),
      this.db.ledgerEntry.findMany({ where, orderBy: { sequence: "asc" } }),
    ]);
    if (
      entries.some((e) => e.currency !== this.currency) ||
      (this.currency !== "USD" &&
        (sales.length || payments.length || expenses.length))
    )
      throw new TransactionError(
        "Existing records use a different currency. Keep the original bookkeeping currency.",
      );
    const legacy: LedgerEvent[] = [];
    for (const sale of sales) {
      let date: string | undefined;
      try {
        if (sale.dueDateText)
          date = dueDate(sale.dueDateText, new Date(sale.createdAt));
      } catch {
        /* Preserve unknown legacy dates without inventing one. */
      }
      legacy.push({
        id: "legacy-sale:" + sale.id,
        legacy: true,
        revision: 1,
        currency: "USD",
        createdAt: sale.createdAt.toISOString(),
        data: {
          action: "sold",
          customer: sale.customer?.name ?? "Walk-in customer",
          item: sale.item.name,
          quantityMinor: Math.round(Number(sale.quantity) * 100),
          total: Math.round(Number(sale.amount) * 100),
          cashReceived:
            sale.kind === "cash" ? Math.round(Number(sale.amount) * 100) : 0,
          changeUsed: 0,
          cashReturned: 0,
          dueDate: date,
        },
      });
    }
    for (const payment of payments)
      legacy.push({
        id: "legacy-payment:" + payment.id,
        legacy: true,
        revision: 1,
        currency: "USD",
        createdAt: payment.createdAt.toISOString(),
        data: {
          action: "paid",
          customer: payment.customer.name,
          total: Math.round(Number(payment.amount) * 100),
          cashReceived: Math.round(Number(payment.amount) * 100),
          changeUsed: 0,
          cashReturned: 0,
        },
      });
    for (const expense of expenses)
      legacy.push({
        id: "legacy-expense:" + expense.id,
        legacy: true,
        revision: 1,
        currency: "USD",
        createdAt: expense.createdAt.toISOString(),
        data: {
          action: "expense",
          customer: "",
          description: expense.description,
          total: Math.round(Number(expense.amount) * 100),
          cashReceived: 0,
          changeUsed: 0,
          cashReturned: 0,
        },
      });
    legacy.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        (a.data.action === "sold"
          ? -1
          : b.data.action === "sold"
            ? 1
            : a.id.localeCompare(b.id)),
    );
    return [
      ...legacy,
      ...entries.map((e) => ({
        id: e.id,
        data: e.data as unknown as Transaction,
        revision: e.revision,
        currency: e.currency,
        createdAt: e.createdAt.toISOString(),
        sourceMessageId: e.sourceMessageId ?? undefined,
      })),
    ];
  }
  async resolveReply(reference: string) {
    const shop = await this.shop();
    let row = await this.db.ledgerEntry.findFirst({
      where: {
        shopId: shop.id,
        OR: [
          { id: reference },
          { sourceMessageId: reference },
          { revisions: { some: { sourceMessageId: reference } } },
        ],
      },
    });
    if (!row) {
      const receipt = await this.db.inboundMessage.findFirst({
        where: { senderId: this.sender, outboundMessageId: reference },
      });
      const response = receipt?.response as { transactionId?: unknown } | null;
      if (typeof response?.transactionId === "string")
        row = await this.db.ledgerEntry.findFirst({
          where: { shopId: shop.id, id: response.transactionId },
        });
    }
    return row
      ? {
          id: row.id,
          data: row.data as unknown as Transaction,
          revision: row.revision,
          currency: row.currency,
          createdAt: row.createdAt.toISOString(),
          sourceMessageId: row.sourceMessageId ?? undefined,
        }
      : null;
  }
  async save(
    data: Transaction,
    id: string,
    sourceMessageId?: string,
    correction?: Correction,
  ): Promise<LedgerEvent> {
    const shop = await this.shop();
    const events = await this.events();
    if (correction) correctionAllowed(events, correction, data.customer);
    const json = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
    if (correction) {
      const old = await this.db.ledgerEntry.findFirstOrThrow({
        where: { id: correction.id, shopId: shop.id },
      });
      const changed = await this.db.ledgerEntry.updateMany({
        where: { id: old.id, shopId: shop.id, revision: correction.revision },
        data: { data: json, revision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new TransactionError(
          "That transaction changed. Reply to its current message with Correct.",
        );
      await this.db.ledgerRevision.create({
        data: {
          entryId: old.id,
          revision: old.revision + 1,
          previous: old.data as Prisma.InputJsonValue,
          replacement: json,
          sourceMessageId,
        },
      });
      return {
        id: old.id,
        data,
        revision: old.revision + 1,
        currency: old.currency,
        createdAt: old.createdAt.toISOString(),
        sourceMessageId: old.sourceMessageId ?? undefined,
      };
    }
    const row = await this.db.ledgerEntry.create({
      data: {
        id,
        shopId: shop.id,
        data: json,
        currency: this.currency,
        sourceMessageId,
      },
    });
    return {
      id: row.id,
      data,
      revision: row.revision,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      sourceMessageId: row.sourceMessageId ?? undefined,
    };
  }
  async records() {
    const transactions = await this.events();
    const view = replay(transactions);
    return {
      transactions,
      accounts: [...view.accounts.values()].map((a) => ({
        ...a,
        chikwereti: a.chikwereti / 100,
        change: a.change / 100,
        credits: a.credits
          .filter((c) => c.remaining)
          .map((c) => ({ ...c, remaining: c.remaining / 100 })),
      })),
      sales: transactions
        .filter((e) => e.data.action === "sold")
        .map((e) => ({
          id: e.id,
          item: e.data.item,
          customer: e.data.customer,
          quantity: (e.data.quantityMinor ?? 100) / 100,
          amount: e.data.total / 100,
          kind: view.allocations.get(e.id)!.newDebt ? "credit" : "cash",
          cashReceived: e.data.cashReceived! / 100,
          changeUsed: e.data.changeUsed / 100,
          cashReturned: e.data.cashReturned / 100,
          createdAt: e.createdAt,
        })),
      payments: transactions
        .filter((e) => e.data.action === "paid")
        .map((e) => ({
          id: e.id,
          customer: e.data.customer,
          amount: e.data.cashReceived! / 100,
          appliedToDebt: view.allocations.get(e.id)!.debtSettled / 100,
          cashReturned: e.data.cashReturned / 100,
          createdAt: e.createdAt,
        })),
      expenses: transactions
        .filter((e) => e.data.action === "expense")
        .map((e) => ({
          id: e.id,
          description: e.data.description,
          amount: e.data.total / 100,
          createdAt: e.createdAt,
        })),
    };
  }
}
