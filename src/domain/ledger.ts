import { cents, dueDate, localDay } from "./dates.js";
import type { Expense, Payment, Sale } from "./types.js";

export type Records = { sales: Sale[]; payments: Payment[]; expenses: Expense[] };
// Payments settle the oldest credit first, separately for each customer.
export function outstanding(records: Records) {
  const paid = new Map<string, number>();
  const key = (s: string) => s.trim().toLowerCase();
  for (const p of records.payments) paid.set(key(p.customer), (paid.get(key(p.customer)) ?? 0) + cents(p.amount));
  return records.sales.filter(s => s.kind === "credit").sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(s => {
    const customer = key(s.customer ?? "");
    const used = Math.min(cents(s.amount), paid.get(customer) ?? 0);
    paid.set(customer, (paid.get(customer) ?? 0) - used);
    let date: string | undefined;
    try { date = dueDate(s.dueDate ?? "", new Date(s.createdAt)); } catch { /* Legacy unknown dates are excluded from due lists. */ }
    return { ...s, remaining: (cents(s.amount) - used) / 100, dueDate: date };
  }).filter(s => s.remaining > 0);
}
export function balances(records: Records) {
  const totals = new Map<string, { customer: string; amount: number }>();
  for (const s of outstanding(records)) {
    const key = (s.customer ?? "").trim().toLowerCase();
    const current = totals.get(key) ?? { customer: s.customer ?? "", amount: 0 };
    current.amount = (cents(current.amount) + cents(s.remaining)) / 100;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a,b) => b.amount - a.amount);
}
export function summary(records: Records, now = new Date()) {
  const today = localDay(now);
  const sum = <T extends { createdAt: string; amount: number }>(items: T[]) => items.filter(x => localDay(new Date(x.createdAt)) === today).reduce((n,x) => n + cents(x.amount), 0) / 100;
  return {
    day: today,
    cashSales: sum(records.sales.filter(s => s.kind === "cash")),
    creditSales: sum(records.sales.filter(s => s.kind === "credit")),
    payments: sum(records.payments),
    expenses: sum(records.expenses),
    outstanding: outstanding(records).reduce((n,s) => n + cents(s.remaining), 0) / 100,
  };
}
