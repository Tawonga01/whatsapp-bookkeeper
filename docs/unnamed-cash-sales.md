# Unnamed cash sales — 29 October 2026

Use `Sold - Tomatoes - 3x1 - Cash 3 dollars` for a sale without a customer name. Quantity and unit price have the same meaning as named sales. Cash received remains explicit; missing cash is asked for.

- Exact payment proceeds to a `Cash sale — Tomatoes` preview and Confirm/Correct/Cancel.
- Short payment asks for the customer name before applying the existing customer-balance and due-date rules.
- Excess cash first asks whether all change was returned. Yes permits an unnamed fully settled sale. No asks for a name to track CHANGE.
- After a name is entered, MUSIKA recalculates against that customer's existing balances; excess handback may need confirming again because old debt can change the excess.
- Unnamed entries have an empty customer field, not a shared Walk-in customer account. They contribute to sales/cash reports but cannot hold CHIKWERETI or CHANGE.
- Existing `cash <item> <quantity> <total>` shorthand also uses this independent unnamed representation when no name is supplied. Historical entries are not rewritten.
- Corrections retain the existing reply-to and audit rules. Independent unnamed sales do not block one another as later customer activity.

No schema migration or existing-data reset is required. Named-customer allocation, dates, confirmation rules, and full-or-none handbacks are unchanged.
