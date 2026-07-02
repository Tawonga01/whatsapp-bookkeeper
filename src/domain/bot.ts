import { helpText, parseCommand, ParseError } from "./parser.js";
import { BookkeepingStore, DebtorBalance, Summary } from "./store.js";
import { BotResponse, Sale, SaleDraft } from "./types.js";

export class BookkeepingBot {
  constructor(private readonly store: BookkeepingStore) {}

  async handleMessage(senderId: string, text: string): Promise<BotResponse> {
    try {
      const command = parseCommand(text);

      switch (command.type) {
        case "sale":
          await this.store.setPendingSale(senderId, command.draft);
          return { text: confirmationText(command.draft) };
        case "confirm": {
          const saved = await this.store.confirmPendingSale(senderId);
          if (!saved) return { text: "No pending sale to save. Send a cash or credit sale first." };
          return { text: `Saved ${saved.kind} sale: ${saved.item}, qty ${saved.quantity}, amount ${money(saved.amount)}.`, saved };
        }
        case "cancel":
          return { text: (await this.store.clearPendingSale(senderId)) ? "Pending sale cancelled." : "No pending sale to cancel." };
        case "payment": {
          const saved = await this.store.recordPayment(command.customer, command.amount);
          return { text: `Saved payment: ${command.customer} paid ${money(command.amount)}.`, saved };
        }
        case "debtors":
          return { text: debtorsText(await this.store.debtorBalances()) };
        case "due_today":
          return { text: salesListText("Due today", await this.store.dueToday()) };
        case "overdue":
          return { text: salesListText("Overdue", await this.store.overdue()) };
        case "summary":
          return { text: summaryText(await this.store.summary()) };
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

function summaryText(summary: Summary): string {
  return [
    "Summary:",
    `Cash sales: ${money(summary.cashSales)}`,
    `Credit sales: ${money(summary.creditSales)}`,
    `Payments received: ${money(summary.paymentsReceived)}`,
    `Outstanding credit: ${money(summary.outstandingCredit)}`,
  ].join("\n");
}

function debtorsText(debtors: DebtorBalance[]): string {
  if (debtors.length === 0) return "No outstanding customer balances.";
  return ["Debtors:", ...debtors.map((entry) => `${entry.customer}: ${money(entry.balance)}`)].join("\n");
}

function salesListText(title: string, sales: Sale[]): string {
  if (sales.length === 0) return `${title}: none.`;
  return [title + ":", ...sales.map((sale) => `${sale.customer ?? "unknown"}: ${sale.item}, ${money(sale.amount)}, due ${sale.dueDate ?? "unknown"}`)].join("\n");
}

function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
