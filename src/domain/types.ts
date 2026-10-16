export type SaleKind = "cash" | "credit";

export type SaleDraft = {
  kind: SaleKind;
  item: string;
  quantity: number;
  amount: number;
  customer?: string;
  dueDate?: string;
};

export type Sale = SaleDraft & {
  id: string;
  createdAt: string;
};

export type Payment = {
  id: string;
  customer: string;
  amount: number;
  createdAt: string;
};

export type BotResponse = {
  text: string;
  saved?: Sale | Payment | Expense | import("./transactions.js").LedgerEvent;
  transactionId?: string;
  choices?: Array<{ id: string; title: string }>;
  buttons?: Array<{ id: string; title: string }>;
};

export type Expense = {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
};
export type Entry = {
  type: "cash" | "credit" | "payment" | "expense";
  item?: string;
  quantity?: number;
  amount?: number;
  customer?: string;
  dueDate?: string;
  description?: string;
};
export type ConversationState = {
  entry: Entry;
  index: number;
  token: string;
  updatedAt: string;
};

export type ParsedCommand =
  | { type: "sale"; draft: SaleDraft }
  | { type: "payment"; customer: string; amount: number }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "debtors" }
  | { type: "due_today" }
  | { type: "overdue" }
  | { type: "summary" }
  | { type: "email_report" }
  | { type: "help" };
