import { createHash, randomUUID } from "node:crypto";
import { dueDate, localDay } from "./dates.js";
import { parseCommand, ParseError } from "./parser.js";
import type { BotResponse } from "./types.js";
import {
  amount,
  customerKey,
  correctionAllowed,
  newAccount,
  parseTransaction,
  preview,
  replay,
  TransactionError,
  type ChatState,
  type Correction,
  type LedgerEvent,
  type MessageContext,
  type Transaction,
} from "./transactions.js";

export interface LedgerStore {
  getState(): Promise<ChatState | null>;
  setState(state: ChatState | null): Promise<void>;
  events(): Promise<LedgerEvent[]>;
  resolveReply(reference: string): Promise<LedgerEvent | null>;
  save(
    data: Transaction,
    id: string,
    sourceMessageId?: string,
    correction?: Correction,
  ): Promise<LedgerEvent>;
}

export class BookkeepingBot {
  constructor(
    private readonly store: LedgerStore,
    private readonly currency = "USD",
    private readonly clock = () => new Date(),
  ) {}
  private money(value: number) {
    return (
      (this.currency === "USD" ? "$" : this.currency + " ") +
      (value / 100).toFixed(2)
    );
  }
  private quantity(value: number) {
    return String(value / 100);
  }
  private date(value?: string) {
    return value
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Harare",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(value + "T12:00:00Z"))
      : "Not specified";
  }
  private buttons(state: ChatState, actions: Array<[string, string]>) {
    return actions.map(([action, title]) => ({
      id: `action:${state.token}:${state.phase}:${action}`,
      title,
    }));
  }
  private fingerprint(events: LedgerEvent[]) {
    return createHash("sha256")
      .update(JSON.stringify(events.map((e) => [e.id, e.revision, e.data])))
      .digest("hex");
  }
  private async phase(state: ChatState, phase: ChatState["phase"]) {
    state.phase = phase;
    state.updatedAt = this.clock().toISOString();
    await this.store.setState(state);
  }
  private help(): BotResponse {
    return {
      text: [
        "MUSIKA ACCOUNTANT",
        "Enter a transaction, for example:",
        "Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars",
        "Makoni - Paid - 5 dollars",
        "Makoni - Returned - 3.60 dollars",
        "SUMMARY · DEBTORS · CHANGE · DUE TODAY · OVERDUE",
        "Reply to a saved transaction with Correct to correct it.",
      ].join("\n"),
    };
  }
  private response(state: ChatState, events: LedgerEvent[]): BotResponse {
    if (state.phase === "reenter")
      return {
        text: "Please enter the transaction again with the correct details.",
      };
    const draft = state.draft!;
    if (state.phase === "cash")
      return {
        text:
          draft.action === "returned"
            ? "How much CHANGE did you return?"
            : "How much cash did you receive?",
      };
    const result = preview(events, draft, state.entryId, state.correction);
    if (state.phase === "useChange") {
      const suffix = result.allocation.newDebt
        ? `Use it towards this sale, leaving ${this.money(result.account.chikwereti)} CHIKWERETI?`
        : `Use ${this.money(draft.changeUsed)} to pay ${draft.cashReceived ? "the rest of" : "for"} this sale?`;
      return {
        text: `${draft.customer} has ${this.money(result.before.change)} CHANGE.\n${suffix}`,
        buttons: this.buttons(state, [
          ["yes", "Yes"],
          ["no", "No"],
        ]),
      };
    }
    if (state.phase === "handback")
      return {
        text: `*${this.money(result.allocation.excess)} CHANGE*\nDid you give it back?`,
        buttons: this.buttons(state, [
          ["yes", "Yes"],
          ["no", "No"],
        ]),
      };
    if (state.phase === "due")
      return {
        text: `When will ${draft.customer} pay?\nCHIKWERETI: *${this.money(result.account.chikwereti)}*`,
        buttons: this.buttons(state, [
          ["enter", "Enter date"],
          ["skip", "Skip"],
        ]),
      };
    if (state.phase === "dateInput")
      return {
        text: "Enter the date, for example Monday, Next Friday, today or YYYY-MM-DD.",
        buttons: this.buttons(state, [["skip", "Skip"]]),
      };
    const lines = [
      `${draft.customer || "Business"} — ${draft.action === "sold" ? draft.item : draft.action === "paid" ? "Payment" : draft.action === "returned" ? "CHANGE returned" : "Expense"}`,
    ];
    if (draft.action === "sold")
      lines.push(
        draft.unitPrice === undefined
          ? `${this.quantity(draft.quantityMinor!)} units = ${this.money(draft.total)}`
          : `${this.quantity(draft.quantityMinor!)} × ${this.money(draft.unitPrice)} = ${this.money(draft.total)}`,
      );
    if (draft.action === "returned")
      lines.push(`Cash returned: ${this.money(draft.cashReturned)}`);
    else if (draft.action === "expense")
      lines.push(draft.description!, `Amount: ${this.money(draft.total)}`);
    else lines.push(`Cash received: ${this.money(draft.cashReceived!)}`);
    if (draft.changeUsed)
      lines.push(`CHANGE used: ${this.money(draft.changeUsed)}`);
    if (draft.action === "sold" && result.allocation.debtSettled)
      lines.push(
        `CHIKWERETI paid: ${this.money(result.allocation.debtSettled)}`,
      );
    if (draft.action !== "expense") {
      if (
        result.account.change ||
        draft.changeUsed ||
        draft.action === "returned" ||
        result.allocation.excess
      )
        lines.push(`CHANGE: *${this.money(result.account.change)}*`);
      if (
        result.account.chikwereti ||
        (draft.action === "paid" && !result.allocation.excess)
      )
        lines.push(`CHIKWERETI: *${this.money(result.account.chikwereti)}*`);
      if (result.account.chikwereti)
        lines.push(`Due: *${this.date(result.account.dueDate)}*`);
      if (
        !result.account.change &&
        !result.account.chikwereti &&
        draft.action === "sold" &&
        !draft.changeUsed &&
        !result.allocation.excess
      )
        lines.push("CHANGE: *" + this.money(0) + "*");
    }
    lines.push(
      "",
      state.correction ? "Save this correction?" : "Save this transaction?",
    );
    return {
      text: lines.join("\n"),
      transactionId: state.entryId,
      buttons: this.buttons(state, [
        ["confirm", "Confirm"],
        ["correct", "Correct"],
        ["cancel", "Cancel"],
      ]),
    };
  }
  private async next(
    state: ChatState,
    events: LedgerEvent[],
    after: "start" | "change" | "handback" = "start",
  ): Promise<BotResponse> {
    const draft = state.draft!;
    if (
      (draft.action === "sold" && draft.cashReceived === undefined) ||
      (draft.action === "paid" && draft.cashReceived === undefined) ||
      (draft.action === "returned" && !draft.total)
    ) {
      await this.phase(state, "cash");
      return this.response(state, events);
    }
    const base = replay(events.filter((e) => e.id !== state.correction?.id));
    const account =
      base.accounts.get(customerKey(draft.customer)) ??
      newAccount(draft.customer);
    if (draft.action === "returned") {
      if (!account.change || draft.total !== account.change)
        throw new TransactionError(
          `${draft.customer} has ${this.money(account.change)} CHANGE. Return the full amount; partial handbacks are not supported.`,
        );
      draft.cashReturned = draft.total;
    }
    if (draft.action === "paid" && !account.chikwereti)
      throw new TransactionError(
        `${draft.customer} has no CHIKWERETI to settle.`,
      );
    if (
      after === "start" &&
      draft.action === "sold" &&
      account.change &&
      draft.total > draft.cashReceived!
    ) {
      draft.changeUsed = Math.min(
        account.change,
        draft.total - draft.cashReceived!,
      );
      await this.phase(state, "useChange");
      return this.response(state, events);
    }
    const result = preview(events, draft, state.entryId, state.correction);
    if (after !== "handback" && result.allocation.excess) {
      await this.phase(state, "handback");
      return this.response(state, events);
    }
    if (
      draft.action === "sold" &&
      result.allocation.newDebt &&
      !draft.dueDate
    ) {
      await this.phase(state, "due");
      return this.response(state, events);
    }
    await this.phase(state, "confirm");
    state.baseFingerprint = this.fingerprint(events);
    await this.store.setState(state);
    return this.response(state, events);
  }
  private parse(text: string): Transaction | null {
    const trade = parseTransaction(text);
    if (trade) return trade;
    const expense =
      /^expense\s+(.+?)\s+(\d+(?:\.\d{1,2})?)(?:\s+dollars?)?$/i.exec(text);
    if (expense)
      return {
        action: "expense",
        customer: "",
        description: expense[1],
        total: amount(expense[2]),
        cashReceived: 0,
        changeUsed: 0,
        cashReturned: 0,
      };
    try {
      const command = parseCommand(text);
      if (command.type === "payment")
        return {
          action: "paid",
          customer: command.customer,
          total: amount(String(command.amount)),
          cashReceived: amount(String(command.amount)),
          changeUsed: 0,
          cashReturned: 0,
        };
      if (command.type === "sale")
        return {
          action: "sold",
          customer: command.draft.customer ?? "Walk-in customer",
          item: command.draft.item,
          quantityMinor: amount(String(command.draft.quantity)),
          total: amount(String(command.draft.amount)),
          cashReceived:
            command.draft.kind === "cash"
              ? amount(String(command.draft.amount))
              : 0,
          changeUsed: 0,
          cashReturned: 0,
          dueDate: command.draft.dueDate
            ? dueDate(command.draft.dueDate, this.clock())
            : undefined,
        };
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
    }
    return null;
  }
  private async report(
    command: string,
    events: LedgerEvent[],
  ): Promise<BotResponse | null> {
    if (
      ![
        "summary",
        "5",
        "debtors",
        "6",
        "change",
        "due today",
        "7",
        "overdue",
        "8",
      ].includes(command)
    )
      return null;
    const view = replay(events),
      day = localDay(this.clock());
    if (command === "summary" || command === "5") {
      let sales = 0,
        cash = 0,
        returned = 0,
        expenses = 0;
      for (const event of events.filter(
        (e) => localDay(new Date(e.createdAt)) === day,
      )) {
        if (event.data.action === "expense") {
          expenses += event.data.total;
          continue;
        }
        const a = view.allocations.get(event.id)!;
        sales += a.sale;
        cash += a.cashReceived;
        returned += a.cashReturned;
      }
      return {
        text: [
          `Today (${day}, Harare time):`,
          `Sales: ${this.money(sales)}`,
          `Cash received: ${this.money(cash)}`,
          `Cash returned: ${this.money(returned)}`,
          `Expenses: ${this.money(expenses)}`,
          `Cash movement: ${this.money(cash - returned - expenses)}`,
          `CHIKWERETI: ${this.money([...view.accounts.values()].reduce((n, a) => n + a.chikwereti, 0))}`,
          `CHANGE: ${this.money([...view.accounts.values()].reduce((n, a) => n + a.change, 0))}`,
          "Cash movement is not profit.",
        ].join("\n"),
      };
    }
    const change = command === "change";
    const accounts = [...view.accounts.values()]
      .filter((a) => (change ? a.change : a.chikwereti))
      .filter((a) =>
        command === "7" || command === "due today"
          ? a.dueDate === day
          : command === "8" || command === "overdue"
            ? a.dueDate && a.dueDate < day
            : true,
      );
    return {
      text: accounts.length
        ? accounts
            .slice(0, 25)
            .map(
              (a) =>
                `${a.customer} — ${change ? "CHANGE" : "CHIKWERETI"}: ${this.money(change ? a.change : a.chikwereti)}${!change ? "; Due: " + this.date(a.dueDate) : ""}`,
            )
            .join("\n") +
          (accounts.length > 25 ? "\nShowing first 25 customers." : "")
        : change
          ? "No outstanding CHANGE."
          : "No outstanding CHIKWERETI for this selection.",
    };
  }
  async handleMessage(
    _sender: string,
    input: string,
    context: MessageContext = {},
  ): Promise<BotResponse> {
    const text = input.trim();
    let command = text.toLowerCase();
    let buttonAction = false;
    let state = await this.store.getState();
    if (
      state &&
      (state.version !== 2 ||
        this.clock().getTime() - new Date(state.updatedAt).getTime() >
          30 * 60_000)
    ) {
      await this.store.setState(null);
      return {
        text: "Your unfinished transaction expired. Please enter it again. Nothing was saved.",
      };
    }
    if (text === "[unsupported message: send MENU]")
      return {
        text: "Please type the transaction or use the buttons. Photos and voice notes are not recorded.",
      };
    if (command.startsWith("action:")) {
      const match = /^action:([^:]+):([^:]+):([^:]+)$/.exec(command);
      if (
        !state ||
        !match ||
        match[1] !== state.token ||
        match[2] !== state.phase
      )
        return {
          text: "That button belongs to an older step. Continue the current transaction or enter it again.",
        };
      command = match[3];
      buttonAction = true;
    }
    if (
      command === "cancel" ||
      (command === "no" &&
        state?.phase !== "handback" &&
        state?.phase !== "useChange")
    ) {
      await this.store.setState(null);
      return { text: "Transaction cancelled." };
    }
    if (
      ["menu", "help", "hi", "hello", "start", "0", "9"].includes(command) ||
      /^hello musika accountant/.test(command)
    )
      return this.help();
    const events = await this.store.events();
    try {
      if (command === "correct" && context.replyTo && !buttonAction) {
        const original = await this.store.resolveReply(context.replyTo);
        if (!original && !state)
          return {
            text: "Please reply to the original saved transaction with Correct.",
          };
        if (original) {
          const account = replay(events).accounts.get(
            customerKey(original.data.customer),
          );
          const correction: Correction = {
            id: original.id,
            revision: original.revision,
            customer: original.data.customer,
            retainedDueDate: account?.dueDate,
          };
          correctionAllowed(events, correction);
          state = {
            version: 2,
            phase: "reenter",
            token: randomUUID(),
            updatedAt: this.clock().toISOString(),
            entryId: original.id,
            correction,
          };
          await this.store.setState(state);
          return this.response(state, events);
        }
      }
      if (command === "correct" || command === "back") {
        if (!state)
          return {
            text: "Please reply to the original saved transaction with Correct.",
          };
        state.draft = undefined;
        state.phase = "reenter";
        state.token = randomUUID();
        state.updatedAt = this.clock().toISOString();
        await this.store.setState(state);
        return this.response(state, events);
      }
      if (state && state.phase !== "reenter") {
        if (state.phase === "cash") {
          const value = amount(
            text,
            state.draft!.action === "sold",
            "Cash amount",
          );
          if (state.draft!.action === "returned") state.draft!.total = value;
          else {
            state.draft!.cashReceived = value;
            if (state.draft!.action === "paid") state.draft!.total = value;
          }
          return await this.next(state, events);
        }
        if (state.phase === "useChange") {
          if (command === "no") {
            state.draft = undefined;
            state.token = randomUUID();
            await this.phase(state, "reenter");
            return this.response(state, events);
          }
          if (command !== "yes") return this.response(state, events);
          return await this.next(state, events, "change");
        }
        if (state.phase === "handback") {
          if (!["yes", "no"].includes(command))
            return this.response(state, events);
          state.draft!.cashReturned =
            command === "yes"
              ? preview(events, state.draft!, state.entryId, state.correction)
                  .allocation.excess
              : 0;
          return await this.next(state, events, "handback");
        }
        if (state.phase === "due" || state.phase === "dateInput") {
          if (command === "enter" || command === "enter date") {
            await this.phase(state, "dateInput");
            return this.response(state, events);
          }
          if (command !== "skip")
            state.draft!.dueDate = dueDate(text, this.clock());
          await this.phase(state, "confirm");
          state.baseFingerprint = this.fingerprint(events);
          await this.store.setState(state);
          return this.response(state, events);
        }
        if (state.phase === "confirm") {
          if (!["confirm", "comfirm"].includes(command))
            return this.response(state, events);
          if (state.baseFingerprint !== this.fingerprint(events)) {
            state.token = randomUUID();
            state.draft!.changeUsed = 0;
            state.draft!.cashReturned = 0;
            const refreshed = await this.next(state, events);
            return {
              ...refreshed,
              text:
                "The records changed. Please review this transaction again.\n" +
                refreshed.text,
            };
          }
          preview(events, state.draft!, state.entryId, state.correction);
          if (
            state.correction?.retainedDueDate &&
            !state.draft!.dueDate &&
            customerKey(state.correction.customer) ===
              customerKey(state.draft!.customer)
          )
            state.draft!.dueDate = state.correction.retainedDueDate;
          const saved = await this.store.save(
            state.draft!,
            state.entryId,
            state.sourceMessageId,
            state.correction,
          );
          await this.store.setState(null);
          return {
            text: state.correction
              ? "Transaction corrected."
              : "Transaction saved.",
            saved,
            transactionId: saved.id,
          };
        }
      }
      const report = await this.report(command, events);
      if (report) return report;
      if (command === "email report")
        return {
          text: "Email delivery is not connected. Send SUMMARY to see your records here.",
        };
      const draft = this.parse(text);
      if (!draft) return this.help();
      if (
        draft.customer.length > 100 ||
        (draft.item && draft.item.length > 100) ||
        (draft.description &&
          (draft.description.length > 100 || /[\r\n]/.test(draft.description)))
      )
        throw new TransactionError(
          "Names and descriptions must be at most 100 characters on one line.",
        );
      const correction = state?.correction;
      if (correction) correctionAllowed(events, correction, draft.customer);
      state = {
        version: 2,
        phase: "cash",
        token: randomUUID(),
        updatedAt: this.clock().toISOString(),
        entryId: correction?.id ?? randomUUID(),
        draft,
        sourceMessageId: context.messageId,
        correction,
      };
      return await this.next(state, events);
    } catch (error) {
      if (error instanceof TransactionError) return { text: error.message };
      // Date parsing errors are validation failures; database failures must propagate to the durable worker.
      if (
        error instanceof Error &&
        /^(Use today|That date is not valid)/.test(error.message)
      )
        return { text: error.message };
      throw error;
    }
  }
}
