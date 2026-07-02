import { ParsedCommand, SaleDraft } from "./types.js";

export class ParseError extends Error {}

const amountPattern = /^\d+(?:\.\d{1,2})?$/;

export function parseCommand(input: string): ParsedCommand {
  const text = input.trim();
  const normalized = text.toLowerCase();

  if (["yes", "y", "confirm", "save"].includes(normalized)) return { type: "confirm" };
  if (["no", "n", "cancel"].includes(normalized)) return { type: "cancel" };
  if (["help", "commands"].includes(normalized)) return { type: "help" };
  if (normalized === "debtors") return { type: "debtors" };
  if (normalized === "due today") return { type: "due_today" };
  if (normalized === "overdue") return { type: "overdue" };
  if (normalized === "summary") return { type: "summary" };
  if (normalized === "email report") return { type: "email_report" };

  const parts = text.split(/\s+/);
  const keyword = parts[0]?.toLowerCase();

  if (keyword === "cash") return parseCash(parts);
  if (keyword === "credit") return parseCredit(parts);
  if (keyword === "paid") return parsePayment(parts);

  throw new ParseError(helpText());
}

function parseCash(parts: string[]): ParsedCommand {
  if (parts.length < 4) {
    throw new ParseError("Use: cash <item> <quantity> <amount> [customer]");
  }

  const [, item, quantityRaw, amountRaw, customer] = parts;
  return {
    type: "sale",
    draft: buildSaleDraft("cash", item, quantityRaw, amountRaw, customer),
  };
}

function parseCredit(parts: string[]): ParsedCommand {
  if (parts.length < 6) {
    throw new ParseError("Use: credit <item> <quantity> <amount> <customer> <due date>");
  }

  const [, item, quantityRaw, amountRaw, customer, ...dueParts] = parts;
  return {
    type: "sale",
    draft: buildSaleDraft("credit", item, quantityRaw, amountRaw, customer, dueParts.join(" ")),
  };
}

function parsePayment(parts: string[]): ParsedCommand {
  if (parts.length !== 3) {
    throw new ParseError("Use: paid <customer> <amount>");
  }

  const [, customer, amountRaw] = parts;
  const amount = parseAmount(amountRaw);
  return { type: "payment", customer, amount };
}

function buildSaleDraft(
  kind: "cash" | "credit",
  item: string,
  quantityRaw: string,
  amountRaw: string,
  customer?: string,
  dueDate?: string,
): SaleDraft {
  const quantity = Number(quantityRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ParseError("Quantity must be a number above 0.");
  }

  const amount = parseAmount(amountRaw);

  if (kind === "credit" && !customer) {
    throw new ParseError("Credit sales need a customer name.");
  }

  if (kind === "credit" && !dueDate) {
    throw new ParseError("Credit sales need an expected payment date.");
  }

  return { kind, item, quantity, amount, customer, dueDate };
}

function parseAmount(value: string): number {
  if (!amountPattern.test(value)) {
    throw new ParseError("Amount must be a number, for example 500 or 24.50.");
  }

  return Number(value);
}

export function helpText(): string {
  return [
    "Commands:",
    "cash <item> <quantity> <amount> [customer]",
    "credit <item> <quantity> <amount> <customer> <due date>",
    "paid <customer> <amount>",
    "debtors | due today | overdue | summary | email report",
  ].join("\n");
}
