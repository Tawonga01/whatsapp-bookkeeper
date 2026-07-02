import { randomUUID } from "node:crypto";
import { Payment, Sale, SaleDraft } from "./types.js";

export type DebtorBalance = {
  customer: string;
  creditTotal: number;
  paidTotal: number;
  balance: number;
};

export class BookkeepingStore {
  private sales: Sale[] = [];
  private payments: Payment[] = [];
  private pendingSales = new Map<string, SaleDraft>();

  setPendingSale(senderId: string, draft: SaleDraft): void {
    this.pendingSales.set(senderId, draft);
  }

  clearPendingSale(senderId: string): boolean {
    return this.pendingSales.delete(senderId);
  }

  confirmPendingSale(senderId: string): Sale | null {
    const draft = this.pendingSales.get(senderId);
    if (!draft) return null;

    const sale: Sale = {
      ...draft,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.sales.push(sale);
    this.pendingSales.delete(senderId);
    return sale;
  }

  recordPayment(customer: string, amount: number): Payment {
    const payment: Payment = {
      id: randomUUID(),
      customer,
      amount,
      createdAt: new Date().toISOString(),
    };

    this.payments.push(payment);
    return payment;
  }

  listSales(): Sale[] {
    return [...this.sales];
  }

  listPayments(): Payment[] {
    return [...this.payments];
  }

  summary(): { cashSales: number; creditSales: number; paymentsReceived: number; outstandingCredit: number } {
    const cashSales = sum(this.sales.filter((sale) => sale.kind === "cash").map((sale) => sale.amount));
    const creditSales = sum(this.sales.filter((sale) => sale.kind === "credit").map((sale) => sale.amount));
    const paymentsReceived = sum(this.payments.map((payment) => payment.amount));

    return {
      cashSales,
      creditSales,
      paymentsReceived,
      outstandingCredit: Math.max(creditSales - paymentsReceived, 0),
    };
  }

  debtorBalances(): DebtorBalance[] {
    const balances = new Map<string, DebtorBalance>();

    for (const sale of this.sales.filter((entry) => entry.kind === "credit" && entry.customer)) {
      const customer = normalizeName(sale.customer!);
      const current = balances.get(customer) ?? { customer, creditTotal: 0, paidTotal: 0, balance: 0 };
      current.creditTotal += sale.amount;
      current.balance += sale.amount;
      balances.set(customer, current);
    }

    for (const payment of this.payments) {
      const customer = normalizeName(payment.customer);
      const current = balances.get(customer) ?? { customer, creditTotal: 0, paidTotal: 0, balance: 0 };
      current.paidTotal += payment.amount;
      current.balance -= payment.amount;
      balances.set(customer, current);
    }

    return [...balances.values()]
      .filter((entry) => entry.balance > 0)
      .sort((left, right) => right.balance - left.balance);
  }

  dueToday(): Sale[] {
    return this.sales.filter((sale) => sale.kind === "credit" && sale.dueDate?.toLowerCase() === "today");
  }

  overdue(): Sale[] {
    return this.sales.filter((sale) => sale.kind === "credit" && sale.dueDate?.toLowerCase() === "overdue");
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
