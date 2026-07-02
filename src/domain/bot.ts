import { helpText, parseCommand, ParseError } from "./parser.js";
import { BookkeepingStore } from "./store.js";
import { BotResponse, SaleDraft } from "./types.js";

export class BookkeepingBot {
  constructor(private readonly store: BookkeepingStore) {}

  handleMessage(senderId: string, text: string): BotResponse {
    try {
      const command = parseCommand(text);

      switch (command.type) {
        case "sale":
          this.store.setPendingSale(senderId, command.draft);
          return { text: confirmationText(command.draft) };
        case "confirm": {
          const saved = this.store.confirmPendingSale(senderId);
          if (!saved) return { text: "No pending sale to save. Send a cash or credit sale first." };
          return { text: `Saved ${saved.kind} sale: ${saved.item}, qty ${saved.quantity}, amount ${money(saved.amount)}.`, saved };
        }
        case "cancel":
          return { text: this.store.clearPendingSale(senderId) ? "Pending sale cancelled." : "No pending sale to cancel." };
        case "payment": {
          const saved = this.store.recordPayment(command.customer, command.amount);
          return { text: `Saved payment: ${command.customer} paid ${money(command.amount)}.`, saved };
        }
        case "debtors":
          return { text: debtorsText(this.store.debtorBalances()) };
        case "due_today":
          return { text: salesListText("Due today", this.store.dueToday()) };
        case "overdue":
          return { text: salesListText("Overdue", this.store.overdue()) };
        case "summary":
          return { text: summaryText(this.store.summary()) };
        case "email_report":
          return { text: "Report email queued. Email delivery will be connected in the next build step." };
        case "help":
          return { text: helpText() };
      }
    } catch (error) {
      if (error instanceof ParseError) return { text: error.message };
      throw error;
    }
  }
}

function confirmationText(draft: SaleDraft): string {
  const lines = [
    `Confirm ${draft.kind} sale:`,
    `Item: ${draft.item}`,
    `Qty: ${draft.quantity}`,
    `Amount: ${money(draft.amount)}`,
  ];

  if (draft.customer) lines.push(`Customer: ${draft.customer}`);
  if (draft.dueDate) lines.push(`Due: ${draft.dueDate}`);
  lines.push("Reply YES to save or CANCEL to discard.");

  return lines.join("\n");
}

function summaryText(summary: ReturnType<BookkeepingStore["summary"]>): string {
  return [
    "Summary:",
    `Cash sales: ${money(summary.cashSales)}`,
    `Credit sales: ${money(summary.creditSales)}`,
    `Payments received: ${money(summary.paymentsReceived)}`,
    `Outstanding credit: ${money(summary.outstandingCredit)}`,
  ].join("\n");
}

function debtorsText(debtors: ReturnType<BookkeepingStore["debtorBalances"]>): string {
  if (debtors.length === 0) return "No outstanding customer balances.";
  return ["Debtors:", ...debtors.map((entry) => `${entry.customer}: ${money(entry.balance)}`)].join("\n");
}

function salesListText(title: string, sales: ReturnType<BookkeepingStore["listSales"]>): string {
  if (sales.length === 0) return `${title}: none.`;
  return [title + ":", ...sales.map((sale) => `${sale.customer ?? "unknown"}: ${sale.item}, ${money(sale.amount)}, due ${sale.dueDate ?? "unknown"}`)].join("\n");
}

function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
