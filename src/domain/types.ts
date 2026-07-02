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
  saved?: Sale | Payment;
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
