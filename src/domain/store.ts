import { PrismaClient } from "@prisma/client";
import { Payment, Sale, SaleDraft } from "./types.js";

export type DebtorBalance = {
  customer: string;
  creditTotal: number;
  paidTotal: number;
  balance: number;
};

export type Summary = {
  cashSales: number;
  creditSales: number;
  paymentsReceived: number;
  outstandingCredit: number;
};

export class BookkeepingStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly shopName = process.env.DEFAULT_SHOP_NAME ?? "Default Shop",
  ) {}

  async setPendingSale(senderId: string, draft: SaleDraft): Promise<void> {
    const shop = await this.ensureShop();

    await this.prisma.pendingSale.upsert({
      where: { senderId },
      create: {
        shopId: shop.id,
        senderId,
        kind: draft.kind,
        item: draft.item,
        quantity: draft.quantity,
        amount: draft.amount,
        customer: draft.customer,
        dueDateText: draft.dueDate,
      },
      update: {
        shopId: shop.id,
        kind: draft.kind,
        item: draft.item,
        quantity: draft.quantity,
        amount: draft.amount,
        customer: draft.customer,
        dueDateText: draft.dueDate,
      },
    });
  }

  async clearPendingSale(senderId: string): Promise<boolean> {
    const result = await this.prisma.pendingSale.deleteMany({ where: { senderId } });
    return result.count > 0;
  }

  async confirmPendingSale(senderId: string): Promise<Sale | null> {
    const pending = await this.prisma.pendingSale.findUnique({ where: { senderId } });
    if (!pending) return null;

    const shopId = pending.shopId;
    const item = await this.ensureItem(shopId, pending.item);
    const customer = pending.customer ? await this.ensureCustomer(shopId, pending.customer) : null;

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          shopId,
          itemId: item.id,
          customerId: customer?.id,
          kind: pending.kind,
          quantity: pending.quantity,
          amount: pending.amount,
          dueDateText: pending.dueDateText,
        },
        include: { item: true, customer: true },
      });

      await tx.pendingSale.delete({ where: { id: pending.id } });
      return created;
    });

    return mapSale(sale);
  }

  async recordPayment(customerName: string, amount: number): Promise<Payment> {
    const shop = await this.ensureShop();
    const customer = await this.ensureCustomer(shop.id, customerName);

    const payment = await this.prisma.payment.create({
      data: {
        shopId: shop.id,
        customerId: customer.id,
        amount,
      },
      include: { customer: true },
    });

    return mapPayment(payment);
  }

  async listSales(): Promise<Sale[]> {
    const shop = await this.ensureShop();
    const sales = await this.prisma.sale.findMany({
      where: { shopId: shop.id },
      include: { item: true, customer: true },
      orderBy: { createdAt: "desc" },
    });

    return sales.map(mapSale);
  }

  async listPayments(): Promise<Payment[]> {
    const shop = await this.ensureShop();
    const payments = await this.prisma.payment.findMany({
      where: { shopId: shop.id },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });

    return payments.map(mapPayment);
  }

  async summary(): Promise<Summary> {
    const shop = await this.ensureShop();
    const [cashSales, creditSales, paymentsReceived] = await Promise.all([
      this.sumSales(shop.id, "cash"),
      this.sumSales(shop.id, "credit"),
      this.sumPayments(shop.id),
    ]);

    return {
      cashSales,
      creditSales,
      paymentsReceived,
      outstandingCredit: Math.max(creditSales - paymentsReceived, 0),
    };
  }

  async debtorBalances(): Promise<DebtorBalance[]> {
    const shop = await this.ensureShop();
    const [sales, payments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { shopId: shop.id, kind: "credit", customerId: { not: null } },
        include: { customer: true },
      }),
      this.prisma.payment.findMany({
        where: { shopId: shop.id },
        include: { customer: true },
      }),
    ]);

    const balances = new Map<string, DebtorBalance>();

    for (const sale of sales) {
      if (!sale.customer) continue;
      const customer = sale.customer.normalizedName;
      const current = balances.get(customer) ?? { customer, creditTotal: 0, paidTotal: 0, balance: 0 };
      const amount = Number(sale.amount);
      current.creditTotal += amount;
      current.balance += amount;
      balances.set(customer, current);
    }

    for (const payment of payments) {
      const customer = payment.customer.normalizedName;
      const current = balances.get(customer) ?? { customer, creditTotal: 0, paidTotal: 0, balance: 0 };
      const amount = Number(payment.amount);
      current.paidTotal += amount;
      current.balance -= amount;
      balances.set(customer, current);
    }

    return [...balances.values()]
      .filter((entry) => entry.balance > 0)
      .sort((left, right) => right.balance - left.balance);
  }

  async dueToday(): Promise<Sale[]> {
    const shop = await this.ensureShop();
    const sales = await this.prisma.sale.findMany({
      where: { shopId: shop.id, kind: "credit", dueDateText: { equals: "today", mode: "insensitive" } },
      include: { item: true, customer: true },
      orderBy: { createdAt: "desc" },
    });

    return sales.map(mapSale);
  }

  async overdue(): Promise<Sale[]> {
    const shop = await this.ensureShop();
    const sales = await this.prisma.sale.findMany({
      where: { shopId: shop.id, kind: "credit", dueDateText: { equals: "overdue", mode: "insensitive" } },
      include: { item: true, customer: true },
      orderBy: { createdAt: "desc" },
    });

    return sales.map(mapSale);
  }

  private async ensureShop() {
    return this.prisma.shop.upsert({
      where: { name: this.shopName },
      create: { name: this.shopName },
      update: {},
    });
  }

  private async ensureCustomer(shopId: string, name: string) {
    const normalizedName = normalizeName(name);

    return this.prisma.customer.upsert({
      where: { shopId_normalizedName: { shopId, normalizedName } },
      create: { shopId, name, normalizedName },
      update: { name },
    });
  }

  private async ensureItem(shopId: string, name: string) {
    const normalizedName = normalizeName(name);

    return this.prisma.item.upsert({
      where: { shopId_normalizedName: { shopId, normalizedName } },
      create: { shopId, name, normalizedName },
      update: { name },
    });
  }

  private async sumSales(shopId: string, kind: "cash" | "credit"): Promise<number> {
    const result = await this.prisma.sale.aggregate({
      where: { shopId, kind },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  private async sumPayments(shopId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: { shopId },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }
}

function mapSale(sale: {
  id: string;
  kind: "cash" | "credit";
  quantity: unknown;
  amount: unknown;
  dueDateText: string | null;
  createdAt: Date;
  item: { name: string };
  customer: { name: string } | null;
}): Sale {
  return {
    id: sale.id,
    kind: sale.kind,
    item: sale.item.name,
    quantity: Number(sale.quantity),
    amount: Number(sale.amount),
    customer: sale.customer?.name,
    dueDate: sale.dueDateText ?? undefined,
    createdAt: sale.createdAt.toISOString(),
  };
}

function mapPayment(payment: {
  id: string;
  amount: unknown;
  createdAt: Date;
  customer: { name: string };
}): Payment {
  return {
    id: payment.id,
    customer: payment.customer.name,
    amount: Number(payment.amount),
    createdAt: payment.createdAt.toISOString(),
  };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
