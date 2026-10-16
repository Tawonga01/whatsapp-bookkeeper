export function localDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dueDate(input: string, now = new Date()): string {
  const value = input.trim().toLowerCase();
  const date = new Date(localDay(now) + "T12:00:00Z");
  if (value === "tomorrow") date.setUTCDate(date.getUTCDate() + 1);
  else if (value !== "today") {
    const weekday = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].indexOf(value.replace(/^next\s+/, ""));
    if (weekday >= 0)
      date.setUTCDate(
        date.getUTCDate() + ((weekday - date.getUTCDay() + 7) % 7 || 7),
      );
    else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new Error(
          "Use today, tomorrow, a weekday, or a date such as 2026-10-30.",
        );
      const parsed = new Date(value + "T12:00:00Z");
      if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
      )
        throw new Error("That date is not valid.");
      return value;
    }
  }
  return date.toISOString().slice(0, 10);
}

export const cents = (amount: number) => Math.round(amount * 100);
export function positiveNumber(input: string, label = "Amount"): number {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim()))
    throw new Error(label + " must be a number with at most 2 decimal places.");
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0 || value > 9999999999.99)
    throw new Error(label + " must be above 0 and at most 9,999,999,999.99.");
  return value;
}
