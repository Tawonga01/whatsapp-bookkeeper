// All monetary values are integer cents. No floating-point money is persisted.
export type Transaction = {
  action: "sold" | "paid" | "returned" | "expense";
  customer: string;
  item?: string;
  quantityMinor?: number;
  unitPrice?: number;
  total: number;
  cashReceived?: number;
  changeUsed: number;
  cashReturned: number;
  dueDate?: string;
  description?: string;
  note?: string;
};
export type LedgerEvent = {
  id: string;
  data: Transaction;
  revision: number;
  createdAt: string;
  currency: string;
  sourceMessageId?: string;
  legacy?: boolean;
};
export type Credit = { id: string; remaining: number };
export type Account = {
  customer: string;
  chikwereti: number;
  change: number;
  dueDate?: string;
  credits: Credit[];
};
export type Allocation = {
  sale: number;
  cashReceived: number;
  cashReturned: number;
  changeUsed: number;
  cashToSale: number;
  debtSettled: number;
  newDebt: number;
  newChange: number;
  excess: number;
  closingDebt: number;
  closingChange: number;
  dueDate?: string;
};
export type Correction = {
  id: string;
  revision: number;
  customer: string;
  retainedDueDate?: string;
};
export type ChatState = {
  version: 2;
  phase:
    | "cash"
    | "useChange"
    | "handback"
    | "due"
    | "dateInput"
    | "confirm"
    | "reenter";
  token: string;
  updatedAt: string;
  entryId: string;
  draft?: Transaction;
  sourceMessageId?: string;
  correction?: Correction;
  baseFingerprint?: string;
};
export type MessageContext = { messageId?: string; replyTo?: string };
export const customerKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export const MAX_CENTS = 999_999_999_999;
export class TransactionError extends Error {}

export function amount(
  input: string,
  allowZero = false,
  label = "Amount",
): number {
  const cleaned = input
    .trim()
    .replace(/^cash\s+/i, "")
    .replace(/^(?:USD\s*|\$\s*)/i, "")
    .replace(/\s*(?:dollars?|USD)$/i, "")
    .trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned))
    throw new TransactionError(
      `${label} must be a number with at most two decimal places.`,
    );
  const [whole, fraction = ""] = cleaned.split(".");
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (value > BigInt(MAX_CENTS) || value < (allowZero ? 0n : 1n))
    throw new TransactionError(
      `${label} must ${allowZero ? "not be negative" : "be above zero"} and be at most 9,999,999,999.99.`,
    );
  return Number(value);
}
export function saleValue(quantityMinor: number, unitPrice: number) {
  const result = (BigInt(quantityMinor) * BigInt(unitPrice) + 50n) / 100n;
  if (result < 1n || result > BigInt(MAX_CENTS))
    throw new TransactionError(
      "The sale total must be above zero and at most 9,999,999,999.99.",
    );
  return Number(result);
}
export function parseTransaction(input: string): Transaction | null {
  const parts = input
    .trim()
    .split(/\s+-\s+/)
    .map((p) => p.trim());
  if (parts.length < 2 || !/^(sold|paid|returned)$/i.test(parts[1]))
    return null;
  const [customer, verb] = parts;
  if (!customer || customer.length > 100 || /[\r\n]/.test(customer))
    throw new TransactionError(
      "Enter a customer name on one line, at most 100 characters.",
    );
  const base = { customer, changeUsed: 0, cashReturned: 0 };
  if (verb.toLowerCase() === "sold") {
    if (parts.length < 4 || parts.length > 5)
      throw new TransactionError(
        "Use: Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars",
      );
    const item = parts[2];
    const product = /^(\d+(?:\.\d{1,2})?)\s*[x×]\s*(\d+(?:\.\d{1,2})?)$/i.exec(
      parts[3],
    );
    if (!item || item.length > 100 || /[\r\n]/.test(item) || !product)
      throw new TransactionError(
        "Enter the item and quantity x unit price, for example Soap - 6x1.70.",
      );
    const quantityMinor = amount(product[1], false, "Quantity");
    const unitPrice = amount(product[2], false, "Unit price");
    let cashReceived: number | undefined;
    if (parts[4]) {
      const cash = /^cash(?:\s+(.*))?$/i.exec(parts[4]);
      if (!cash)
        throw new TransactionError(
          "Specify cash received, for example Cash 6 dollars. Zero cash is allowed.",
        );
      if (cash[1]) cashReceived = amount(cash[1], true, "Cash received");
    }
    return {
      ...base,
      action: "sold",
      item,
      quantityMinor,
      unitPrice,
      total: saleValue(quantityMinor, unitPrice),
      cashReceived,
    };
  }
  if (parts.length > 3 && verb.toLowerCase() !== "paid")
    throw new TransactionError(
      "Use: Makoni - Returned - 3.60 dollars. Return the full customer CHANGE balance.",
    );
  const note = parts.slice(3).join(" - ");
  if (note.length > 300 || /[\r\n]/.test(note))
    throw new TransactionError(
      "Payment notes must be at most 300 characters on one line.",
    );
  const value = parts[2] ? amount(parts[2]) : undefined;
  return {
    ...base,
    action: verb.toLowerCase() as "paid" | "returned",
    total: value ?? 0,
    cashReceived: verb.toLowerCase() === "paid" ? value : 0,
    ...(note ? { note } : {}),
  };
}

function checked(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS)
    throw new TransactionError(`${label} is outside the supported range.`);
  return value;
}
export function newAccount(customer: string): Account {
  return { customer, chikwereti: 0, change: 0, credits: [] };
}
export function applyTransaction(
  account: Account,
  data: Transaction,
  id: string,
): Allocation {
  for (const [label, value] of Object.entries({
    total: data.total,
    cashReceived: data.cashReceived ?? -1,
    changeUsed: data.changeUsed,
    cashReturned: data.cashReturned,
  }))
    checked(value, label);
  if (data.total === 0 && data.action !== "paid")
    throw new TransactionError("Amount must be above zero.");
  let cashToSale = 0,
    debtSettled = 0,
    newDebt = 0,
    excess = 0;
  const settle = (available: number) => {
    for (const credit of account.credits) {
      const used = Math.min(available, credit.remaining);
      credit.remaining -= used;
      available -= used;
      debtSettled += used;
      if (!available) break;
    }
    account.chikwereti -= debtSettled;
    return available;
  };
  if (data.action === "sold") {
    cashToSale = Math.min(data.cashReceived!, data.total);
    if (
      data.changeUsed > account.change ||
      data.changeUsed > data.total - cashToSale
    )
      throw new TransactionError(
        "The CHANGE used is not available for this sale.",
      );
    // Cash with a sale settles this sale first; only the excess settles old credit.
    excess = settle(data.cashReceived! - cashToSale);
    account.change -= data.changeUsed;
    newDebt = data.total - cashToSale - data.changeUsed;
    if (newDebt) {
      account.credits.push({ id, remaining: newDebt });
      account.chikwereti += newDebt;
    }
  } else if (data.action === "paid") {
    if (!data.cashReceived || data.changeUsed)
      throw new TransactionError("Enter a positive payment amount.");
    excess = settle(data.cashReceived!);
  } else if (data.action === "returned") {
    if (
      data.cashReceived ||
      data.changeUsed ||
      !account.change ||
      data.total !== account.change ||
      data.cashReturned !== data.total
    )
      throw new TransactionError(
        `${account.customer} has ${(account.change / 100).toFixed(2)} CHANGE. Return the full amount; partial handbacks are not supported.`,
      );
    account.change = 0;
  }
  if (data.action === "sold" || data.action === "paid") {
    if (data.cashReturned !== 0 && data.cashReturned !== excess)
      throw new TransactionError(
        "Return all the CHANGE or none. Partial handbacks are not supported.",
      );
    account.change += excess - data.cashReturned;
  }
  if (data.dueDate) account.dueDate = data.dueDate;
  checked(account.chikwereti, "CHIKWERETI");
  checked(account.change, "CHANGE");
  if (account.chikwereti && account.change)
    throw new TransactionError(
      "CHIKWERETI and CHANGE cannot be left outstanding together. Please correct the transaction.",
    );
  return {
    sale: data.action === "sold" ? data.total : 0,
    cashReceived: data.cashReceived!,
    cashReturned: data.cashReturned,
    changeUsed: data.changeUsed,
    cashToSale,
    debtSettled,
    newDebt,
    newChange:
      data.action === "sold" || data.action === "paid"
        ? excess - data.cashReturned
        : 0,
    excess,
    closingDebt: account.chikwereti,
    closingChange: account.change,
    dueDate: account.dueDate,
  };
}
export function replay(events: LedgerEvent[]) {
  const accounts = new Map<string, Account>();
  const allocations = new Map<string, Allocation>();
  for (const event of events) {
    if (event.data.action === "expense") continue;
    const key = customerKey(event.data.customer);
    const account = accounts.get(key) ?? newAccount(event.data.customer);
    allocations.set(event.id, applyTransaction(account, event.data, event.id));
    accounts.set(key, account);
  }
  return { accounts, allocations };
}
export function correctionAllowed(
  events: LedgerEvent[],
  correction: Correction,
  customer = correction.customer,
) {
  const index = events.findIndex((e) => e.id === correction.id);
  if (
    index < 0 ||
    events[index].legacy ||
    events[index].revision !== correction.revision
  )
    throw new TransactionError(
      "That saved transaction is unavailable or has changed. Reply to its current message with Correct.",
    );
  const names = new Set([
    customerKey(correction.customer),
    customerKey(customer),
  ]);
  if (
    events
      .slice(index + 1)
      .some(
        (e) =>
          e.data.action !== "expense" &&
          names.has(customerKey(e.data.customer)),
      )
  )
    throw new TransactionError(
      "This transaction has later customer activity. Correcting it needs a review of those later transactions first.",
    );
}
export function preview(
  events: LedgerEvent[],
  draft: Transaction,
  id: string,
  correction?: Correction,
) {
  if (correction) correctionAllowed(events, correction, draft.customer);
  const base = events.filter((e) => e.id !== correction?.id);
  const view = replay(base);
  const account = structuredClone(
    view.accounts.get(customerKey(draft.customer)) ??
      newAccount(draft.customer),
  );
  if (
    correction?.retainedDueDate &&
    customerKey(correction.customer) === customerKey(draft.customer)
  )
    account.dueDate = correction.retainedDueDate;
  const before = structuredClone(account);
  const allocation = applyTransaction(account, draft, id);
  return { before, account, allocation };
}
