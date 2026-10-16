# MUSIKA ACCOUNTANT transaction specification

Business specification — 16 October 2026. The owner subsequently authorised backend implementation of the approved flows. See [implementation status and boundaries](backend-implementation.md); source-only examples and unresolved cases below are not approval to override later decisions.

This document describes transaction behaviour using the owner's examples and Excel register. It does not change the existing backend or prescribe its technical implementation. The 18 scenarios are the first reference set, not a claim that every trading situation has been covered.

## 1. Sources and decision status

- Owner's scenario notes: 18 scenarios covering sales, debt repayments, held change and returns of held change, plus matching and validation rules.
- `trader_18_scenarios_single_register (1).xlsx`, worksheet `Transaction Register`, headers A4:U4 and events A5:U31. One chronological register contains 27 events involving Makoni. Scenario labels group related events; balances do not reset between scenarios.
- Owner's decision on 16 October 2026: when a customer owes $8, buys $3 of new goods and hands over $5 without allocation instructions, pay for the new $3 sale first and apply the remaining $2 to old debt. Closing debt is $6.
- Owner-approved scenario 1 wording: `Makoni - Sold - Nails - 5x2 - Cash 10 dollars`. The amount physically received must be explicit. A message containing only `Cash` requires a follow-up question rather than an assumption of full payment.
- Owner-directed scenario 2 flow: `Makoni - Sold - Nails - 5x2 - Cash 0 dollars` starts a fully unpaid sale. MUSIKA asks when payment is due; the vendor can answer naturally, for example `Monday` or `Next Friday`. The vendor need not write a separate `Credit` command or include the due date in the initial message.
- Owner-confirmed due-date rule: the newest answer to the due-date question replaces the customer's previously captured due date. If no new answer is supplied, the previously captured date persists. This supersedes the earlier assumption of a separately controlling due date for each sale. The owner also confirmed that if no date has ever been captured and none is supplied, allow final confirmation with the due date unspecified.
- Owner-directed customer terminology: money the vendor owes the customer is `CHANGE`; money owed to the vendor is `CHIKWERETI`. These terms supersede generic `held` and `owes` labels in the proposed customer-facing messages below.
- Owner-confirmed handback rule: after receiving $15.00 for a $10.20 sale, the vendor either returns all $4.80 or returns none and owes $4.80 CHANGE. The same full-return rule applies later when returning previously recorded CHANGE. Partial handbacks are not supported at either stage. Earlier source examples of partial change returns are superseded.

Requirements directly illustrated in the sources are identified below as reference behaviour. Confirmation messages and handling of underspecified inputs are proposed conversation behaviour. Unresolved decisions appear in section 9 rather than being silently chosen.

The workbook's 27 stored result rows agree with an independent cent-based calculation of its roll-forward formulas. This confirms the arithmetic of the supplied inputs; it does not establish that the spreadsheet validates transaction matching or enforces every business rule.

## 2. What the customer account represents

Maintain two separate amounts for each customer within the vendor's business and the relevant currency:

| Amount | Meaning |
| --- | --- |
| CHIKWERETI (debt balance) | Money the customer owes the trader for unpaid goods. |
| CHANGE (held balance) | Money the vendor owes the customer. It can be used on later goods or returned under the agreed handback rules. |

The source workbook sometimes shows both amounts positive, for example row 8 ($17.00 debt and $4.80 held). This is source history, not approval of such a product outcome. During scenario 5 review, the owner explicitly rejected leaving $4.80 CHANGE untouched while creating $3.00 CHIKWERETI on a sale receiving zero cash. That message implicitly means available CHANGE is being used. Other source cases that show both balances positive require review before they can be approved as product behaviour.

The account status after a confirmed event therefore has four possible forms:

- `CHIKWERETI: $6.00; CHANGE: $0.00` when only money owed to the vendor is positive.
- `CHIKWERETI: $0.00; CHANGE: $4.80` when only money owed to the customer is positive.
- A dual-positive display such as the workbook's $17.00 debt and $4.80 held is unapproved source behaviour, not a valid branch to introduce in the scenario 5 flow.
- `SETTLED; CHIKWERETI: $0.00; CHANGE: $0.00` when both are zero.

Use these terms in customer-facing prompts and confirmations. The unchanged source workbook and historical quotation blocks retain their original headings and wording. Earlier conversation drafts using `owed` and `held` must use the approved terms before implementation.

Examples use dollars as supplied. They do not define an exchange rate or authorise combining different currencies.

## 3. The three transaction actions

| Action | Meaning | Main information |
| --- | --- | --- |
| Sold | Goods supplied to a customer. Payment can combine new cash, held money and new credit. A cash receipt can also settle old debt or create held change. | Customer, item, quantity, unit price or an explicit total, cash received, held money used, allocation, and due date for new credit. |
| Paid | Customer pays an existing debt. The instruction can refer to all old debts or identify a sale by natural details. An agreed excess may become held money. | Customer, amount received, intended debt or matching details, and treatment of any excess. |
| Returned | Trader returns some or all of the customer's held money. | Customer, amount returned and, where supplied, the receipt/payment being returned. |

`Returned` means money returned from the held balance in these examples. It does not mean goods returned, a cancelled sale or a refund of sale revenue.

Sale value and cash physically received are different amounts. In `6 x 1.70`, quantity is 6, unit price is $1.70 and sale value is $10.20. A customer handing over $15.00 has not bought $15.00 of goods.

## 4. Allocation rules

### 4.1 Explicit instructions

Preserve explicit instructions such as `Old Debt 2`, `Change Held 4.80`, `Held`, or a reference to a particular sale. Confirm the allocation before saving. Conflicting or impossible instructions require clarification.

Workbook row 8 explicitly leaves $4.80 held even though earlier debts exist. Retain this as evidence of the original source; its dual-positive result needs owner review following the later rejection of the proposed dual-balance scenario 5 outcome. Do not treat this historical row as permission to create that rejected outcome.

### 4.2 New cash received with a new sale

**Owner-confirmed default:** pay for the current purchase first, then use the remaining new cash to reduce existing debt.

Example:

| Step | Amount |
| --- | ---: |
| Opening debt | $8.00 |
| New purchase | $3.00 |
| Cash handed over | $5.00 |
| Cash applied to new purchase | $3.00 |
| Cash applied to old debt | $2.00 |
| Closing debt | $6.00 |
| New held money | $0.00 |

If the cash does not fully cover the current purchase, the uncovered part becomes new credit after the vendor confirms the amount and due date. Existing debt remains unless the vendor explicitly allocates payment to it.

For cash received with a sale, settle that sale first and apply any remainder to the oldest CHIKWERETI. Do not transfer this named-sale-first rule to a later standalone payment. Available CHANGE use is confirmed through the approved questions in section 8.

### 4.3 Payment allocation: corrected owner-confirmed distinction

The owner corrected the proposed treatment of a later payment naming an earlier sale. The action and transaction context determine allocation:

1. Restrict every transaction to the correct vendor and customer.
2. `Paid` after credit sales is a standalone repayment: settle the earliest outstanding credit first, then the next earliest until the payment is exhausted. Sale details mentioned in that later payment do not make it jump ahead of earlier CHIKWERETI.
3. Cash received with a `Sold` transaction pays for the named sale first. Any remainder then settles the oldest outstanding CHIKWERETI.
4. Preserve original event order when outstanding credits have identical dates. Genuine separate sales remain separate records.
5. A partial repayment leaves the unpaid remainder attached to the affected sale. The effective customer due date follows the latest-answer/carry-forward rule in section 4.5.

The older scenario notes described matching later payments to particular sales by date, item and quantity. That restriction is superseded for standalone repayments by this later owner correction. No restricted named-sale repayment mode has been approved.

Example: with an older $2.00 Nails debt and a newer $3.00 Soap debt, `Makoni - Paid - 3 dollars` settles the full Nails debt and $1.00 of Soap, leaving $2.00 CHIKWERETI. The owner approved the existing partial-payment confirmation pattern and retention of the captured due date for this example.

Corrected example for workbook rows 23–25: Makoni has an older $5 credit and two later $2 Nails credits. A subsequent $3 payment reduces the earliest $5 credit to $2. Both $2 Nails credits remain unpaid. Total CHIKWERETI is $6. The earlier assistant proposal to clear the Nails credits first was explicitly rejected. The workbook's aggregate totals still reconcile, but they do not prove which credits were settled. Use the owner's corrected allocation, not that rejected proposal.

### 4.4 Held money

- Held money can fund an entire sale or part of one.
- Using held money reduces the held balance and does not count as newly received cash.
- A confirmed cash excess left with the trader increases the held balance.
- Returning CHANGE reduces the CHANGE balance and records cash going out. It does not reduce sales or increase expenses. A partial handback is not an approved flow.
- The owner confirmed that later returns of previously recorded CHANGE must also be made in full. If the full amount cannot be returned, keep the CHANGE outstanding rather than recording a partial cash handback. This does not prohibit partial customer repayments of CHIKWERETI.
- A return greater than the available held amount must be rejected.
- The source includes simultaneous held money and debt, but the owner rejected the proposed scenario 5 outcome retaining CHANGE while creating CHIKWERETI. Do not use the source's older dual-balance examples to override that decision. Wider allocation rules for other starting balances remain for review.

For the approved scenarios 5 and 6, a sale receiving $0.00 cash while CHANGE is available must confirm its use. Scenario 5 uses enough CHANGE to pay the entire sale; scenario 6 uses all available CHANGE and asks about the due date for the uncovered CHIKWERETI. The owner also approved mixed cash plus CHANGE, both when they cover the sale and when CHIKWERETI remains. See section 8 for the approved questions and outcomes.

### 4.5 Customer due date: latest answer, otherwise carry forward

**Owner-confirmed rule:** use the newest answer supplied to the due-date question as the customer's due date. If the vendor does not supply a new answer, keep the previously captured due date.

This is a customer-level due date for the outstanding balance. A new answer changes the date for the resulting balance, rather than adding an independent payment deadline for the latest sale alone. A repayment without a new due-date answer does not change the captured date.

Example continuing scenarios 2 and 3:

- Makoni already owes $10.00 due Friday.
- A further $12.00 sale receives $5.00 cash, leaving $7.00 unpaid. Total debt becomes $17.00.
- If the vendor answers `Monday`, show $17.00 due Monday in the confirmation.
- If no new date is supplied, show $17.00 due the previously captured Friday.

An unanswered question must not clear a captured date or substitute today's date. If no date has ever been captured and none is supplied, the owner permits the transaction to proceed to final confirmation with the due date unspecified. Do not block confirmation solely for this missing date, and do not invent a date. Only final Confirm saves the transaction; silence is not confirmation.

The original workbook dates remain source history. Its numeric acceptance balances are unchanged by this refinement, but tests of the effective due date must follow this newer owner-confirmed rule.

### 4.6 Cash change at sale: return all or keep all

For the stated example, the sale is $10.20 and cash physically received is $15.00. The cash difference is $4.80.

| Vendor's action | Cash received | Cash returned | New CHANGE owed to customer | New CHIKWERETI |
| --- | ---: | ---: | ---: | ---: |
| Can give the full difference back | $15.00 | $4.80 | $0.00 | $0.00 |
| Cannot give the difference back | $15.00 | $0.00 | $4.80 | $0.00 |

Do not offer or accept a split such as returning $2.00 and carrying $2.80 as CHANGE. Ask which full-or-none outcome occurred. Do not silently record a physically partial handback as either approved outcome; the vendor must resolve it.

These amounts assume no other customer balance or explicit old-debt allocation. Existing CHIKWERETI is still governed by the current-sale-first rule unless the vendor explicitly leaves the excess as CHANGE. The sale confirmation should ask about the full $4.80 handback when that is the intended excess treatment, rather than silently overriding an existing repayment allocation.

## 5. Balance calculations and checks

These are conceptual calculations, not a database design:

```text
Sale value = quantity × unit price
New debt = sale value − cash allocated to this sale − held money used
Closing debt = opening debt + new debt − old debt settled
Closing held = opening held + new money held − held money used − money returned
```

Amounts are calculated in cents and shown to two decimal places for these examples. Accepted allocations must keep new debt, closing debt and closing held non-negative. Do not hide an invalid allocation by forcing a negative result to zero.

For every event, account for all cash received: the portion paying for goods, the portion settling old debt, any amount held, and any cash returned. Held money spent is an internal application of an existing customer balance, not another cash receipt.

Before confirmation, check:

- The vendor and customer are identified.
- Sale value, quantity, repayments and money returned are positive and expressed in a known currency. Cash received at a sale may explicitly be zero; negative cash received is invalid.
- A sale's quantity, price and stated total agree, or the vendor resolves the conflict.
- Cash allocated does not exceed cash received; the same money is not used twice.
- Held money used or returned is available in the relevant customer account.
- A later debt payment settles real outstanding credits oldest first; cash received with a sale pays for that sale first, then older credits.
- The effective customer due date is the newest answer, or the previously captured date when unanswered. A repayment alone does not replace it. If no date has ever been captured and none is supplied, allow final confirmation with an unspecified due date.
- The balance shown in confirmation follows from the stated allocation.

Only a confirmed event changes saved balances. Rejected, cancelled or unfinished messages do not.

## 6. The 18 scenario categories

| Scenario | Reference behaviour | Workbook rows |
| ---: | --- | --- |
| 1 | Ordinary cash sale. | 5 |
| 2 | Sale entirely on credit. | 6 |
| 3 | Sale partly paid in cash, with the remainder on credit. | 7 |
| 4 | Cash sale with excess explicitly left as held change. | 8 |
| 5 | Sale paid entirely using held money. | 9 |
| 6 | Sale partly funded by held money; remainder becomes debt. | 10 |
| 7 | New credit added while an earlier debt exists. | 11 |
| 8 | Account moves from debt to held money after repayment and a new sale. | 12–13 |
| 9 | Account moves from held money to debt after a new purchase. | 14 |
| 10 | One payment fully settles outstanding debt. | 15 |
| 11 | One payment partially settles a credit sale. | 16–17 |
| 12 | Further payments fully settle that sale. | 18–19 |
| 13 | Multiple repayments leave part of a sale unpaid. | 20–22 |
| 14 | Source illustration includes identical sales; later payment uses earliest outstanding credit first under the corrected owner rule. | 23–25 |
| 15 | Payment settles all old debt and leaves the excess held. | 26 |
| 16 | Full return of held money. | 27 |
| 17 | New held change is created and part is returned. | 28–29 |
| 18 | Further returns exhaust the remaining held money. | 30–31 |

The prose examples describe categories. The workbook supplies a continuous sequence with its own amounts, items and dates. For instance, scenario 6 uses $1.80 held against a $10.20 sale in the workbook, rather than the standalone note's $4 against a $10 sale. Preserve both examples with their original starting conditions; do not reset workbook balances to make them match the standalone illustration.

Scenarios 17 and 18 contain partial cash handbacks in the original source. Preserve them as source history, not as approved product behaviour. The owner confirmed that the no-partial-handback rule applies both at sale and to later returns of previously recorded CHANGE. A later return must be in full; otherwise CHANGE stays outstanding.

## 7. Acceptance reference: 27 chronological events

All amounts are in the workbook's dollar units. `Cash in` combines cash handed over at a sale and later debt payments. `Debt settled` is the portion actually applied to existing debt. Closing balances carry into the next row.

This table reproduces source results. The partial-return sequence in rows 29–31 is historical reference only and is superseded by the confirmed full-return rule. Those rows must not be treated as approved acceptance requirements simply because their arithmetic reconciles. A replacement flow for the $4.80 CHANGE returns $4.80 once in full, or leaves $4.80 outstanding until it can be returned in full.

| Excel row | Scenario | Date (2026) | Event | Sale value | Cash in | Held used | Debt settled | New held | Cash returned | Closing debt | Closing held |
| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 1 | Jul 01 | Sell Nails, 5 × 2, cash | 10.00 | 10.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 6 | 2 | Jul 02 | Sell Nails, 5 × 2, credit due Jul 14 | 10.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 10.00 | 0.00 |
| 7 | 3 | Jul 03 | Sell Nails, 6 × 2; cash 5, remainder due Jul 14 | 12.00 | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 | 17.00 | 0.00 |
| 8 | 4 | Jul 04 | Sell Soap, 6 × 1.70; explicitly hold change | 10.20 | 15.00 | 0.00 | 0.00 | 4.80 | 0.00 | 17.00 | 4.80 |
| 9 | 5 | Jul 05 | Sell Sweet, 3 × 1, from held money | 3.00 | 0.00 | 3.00 | 0.00 | 0.00 | 0.00 | 17.00 | 1.80 |
| 10 | 6 | Jul 06 | Sell Soap, 6 × 1.70; use held, remainder due Jul 20 | 10.20 | 0.00 | 1.80 | 0.00 | 0.00 | 0.00 | 25.40 | 0.00 |
| 11 | 7 | Jul 07 | Sell Sweet, 3 × 1, credit due Jul 20 | 3.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 28.40 | 0.00 |
| 12 | 8 | Jul 08 | Receive 26.40 for old debts | 0.00 | 26.40 | 0.00 | 26.40 | 0.00 | 0.00 | 2.00 | 0.00 |
| 13 | 8 | Jul 09 | Sell Sweet, 1 × 1; cash 5, old debt 2, hold 2 | 1.00 | 5.00 | 0.00 | 2.00 | 2.00 | 0.00 | 0.00 | 2.00 |
| 14 | 9 | Jul 10 | Sell Pack, 1 × 7; use held, remainder due Jul 25 | 7.00 | 0.00 | 2.00 | 0.00 | 0.00 | 0.00 | 5.00 | 0.00 |
| 15 | 10 | Jul 11 | Receive 5 for old debts | 0.00 | 5.00 | 0.00 | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 16 | 11 | Jul 12 | Sell Sweet, 5 × 1, credit due Jul 26 | 5.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 5.00 | 0.00 |
| 17 | 11 | Jul 13 | Receive 2 for Jul 12 Sweet sale, quantity 5 | 0.00 | 2.00 | 0.00 | 2.00 | 0.00 | 0.00 | 3.00 | 0.00 |
| 18 | 12 | Jul 14 | Receive 1 for the same Sweet sale | 0.00 | 1.00 | 0.00 | 1.00 | 0.00 | 0.00 | 2.00 | 0.00 |
| 19 | 12 | Jul 15 | Receive 2 for the same Sweet sale | 0.00 | 2.00 | 0.00 | 2.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 20 | 13 | Jul 16 | Sell Nails, 5 × 2, credit due Jul 30 | 10.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 10.00 | 0.00 |
| 21 | 13 | Jul 17 | Receive 2 for Jul 16 Nails sale, quantity 5 | 0.00 | 2.00 | 0.00 | 2.00 | 0.00 | 0.00 | 8.00 | 0.00 |
| 22 | 13 | Jul 18 | Receive 3 for the same Nails sale | 0.00 | 3.00 | 0.00 | 3.00 | 0.00 | 0.00 | 5.00 | 0.00 |
| 23 | 14 | Jul 19 | First Nails sale, 1 × 2, due Aug 01 | 2.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 7.00 | 0.00 |
| 24 | 14 | Jul 19 | Second identical Nails sale, due Aug 01 | 2.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 9.00 | 0.00 |
| 25 | 14 | Jul 20 | Receive 3 matching Jul 19 Nails, quantity 1 | 0.00 | 3.00 | 0.00 | 3.00 | 0.00 | 0.00 | 6.00 | 0.00 |
| 26 | 15 | Jul 21 | Receive 10; settle all old debts, hold excess | 0.00 | 10.00 | 0.00 | 6.00 | 4.00 | 0.00 | 0.00 | 4.00 |
| 27 | 16 | Jul 22 | Return all 4 held from Jul 21 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 4.00 | 0.00 | 0.00 |
| 28 | 17 | Jul 23 | Sell Soap, 6 × 1.70; hold change | 10.20 | 15.00 | 0.00 | 0.00 | 4.80 | 0.00 | 0.00 | 4.80 |
| 29 | 17 | Jul 24 | Return 2 from Jul 23 held receipt | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2.00 | 0.00 | 2.80 |
| 30 | 18 | Jul 25 | Return another 1 from that receipt | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 1.80 |
| 31 | 18 | Jul 26 | Return remaining 1.80 from that receipt | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.80 | 0.00 | 0.00 |

In addition to the closing totals, scenario 14 must follow the corrected allocation: the $3 later payment reduces the older July 16 debt from $5 to $2. Both July 19 debts remain $2 each, for total CHIKWERETI of $6. The earlier proposed $5-plus-$1 allocation is superseded. Matching totals alone is not enough.

## 8. Proposed WhatsApp confirmation behaviour

### Scenario 1: approved cash-sale conversation

Starting position: Makoni owes $0.00 and has $0.00 held.

Vendor sends:

```text
Makoni - Sold - Nails - 5x2 - Cash 10 dollars
```

MUSIKA shows:

```text
Makoni — Nails
5 × $2.00 = $10.00
Cash received: $10.00
Applied to this sale: $10.00
After saving: $0.00 owed; $0.00 held.

Save this transaction?
Confirm · Correct · Cancel
```

After confirmation: `Transaction saved.` This follows the owner's later approval of one simple acknowledgement for confirmed transactions.

If the vendor writes only `Cash`, ask `How much cash did you receive?` Do not infer the amount from the sale value. Use the label `Cash received` to distinguish money handed over from goods sold. The workbook's historical source messages remain unchanged; their explicit cash input columns supply the reference amounts.

### Scenario 2: owner-directed unpaid-sale conversation

Starting position: Makoni owes $0.00 and has $0.00 held. No instruction to spend held money is involved in this example.

Vendor sends:

```text
Makoni - Sold - Nails - 5x2 - Cash 0 dollars
```

MUSIKA asks:

```text
Makoni — Nails
5 × $2.00 = $10.00
Cash received: $0.00
Unpaid amount: $10.00
When should Makoni pay the $10.00?
```

The vendor can reply `Monday` or `Next Friday`. A new answer replaces the customer's captured due date; if no new answer is supplied and a date already exists, carry it forward. If no date exists and none is supplied, allow confirmation with the due date unspecified. Do not require the vendor to rewrite the original sale or enter a separate credit command.

Proposed final confirmation after the due-date reply:

```text
Makoni — Nails
5 × $2.00 = $10.00
Cash received: $0.00
New debt: $10.00
Payment due: [resolved weekday and calendar date]
After saving: $10.00 owed; $0.00 held.

Save this transaction?
Confirm · Correct · Cancel
```

The final confirmation should display a concrete calendar date so the vendor can correct the interpretation. The owner confirmed that on a Friday, both `Friday` and `Next Friday` mean the following Friday; use `Today` explicitly for the current day. Other unresolved date interpretation questions remain in O5.

### Scenario 3: part cash, remainder unpaid, with due-date carry-forward

Vendor sends:

```text
Makoni - Sold - Nails - 6x2 - Cash 5 dollars
```

Proposed question:

```text
Sale total: $12.00
Cash received: $5.00
Unpaid on this sale: $7.00
When should Makoni pay?
```

If $10.00 is already outstanding, the resulting total debt is $17.00. Show the newest supplied due-date answer for that balance, or retain the previously captured date when Skip is selected. The owner approved clickable Enter date and Skip buttons for the due-date interaction. Skip continues to confirmation, not automatic saving.

### Scenario 4: owner-approved CHANGE interaction

For this interaction, Makoni starts with zero CHANGE and zero CHIKWERETI. Vendor sends:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars
```

Lead with the difference and one short question. Do not repeat the full sale at this intermediate step:

```text
$4.80 CHANGE
Did you give it back?

Yes · No
```

If the vendor answers `Yes`, present exactly this detail block:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $15.00
CHANGE: $0.00
```

If the vendor answers `No`, present exactly this detail block:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $15.00
CHANGE: $4.80
```

Emphasise the CHANGE amount in the displayed confirmation. Keep the confirmed cash received at $15.00 in both branches. Do not add `Cash returned` or a zero `CHIKWERETI` line to these owner-specified detail blocks. A `Yes` answer still means the entire $4.80 was returned; a `No` answer means none was returned. The amount actually returned remains part of the transaction meaning even though it is omitted from this concise display.

The previously discussed confirm/correct/cancel step is separate from the detail block. Selecting Yes/No answers the handback question and prepares the confirmation; it does not by itself authorise saving the transaction. There is no partial-handback option. The interaction for a customer who already has CHANGE or CHIKWERETI remains to be reviewed separately.

### Scenario 5: owner-approved offer to use CHANGE

Starting position: Makoni has $4.80 CHANGE and $0.00 CHIKWERETI. Vendor sends:

```text
Makoni - Sold - Sweets - 3x1 - Cash 0 dollars
```

MUSIKA asks:

```text
Makoni has $4.80 CHANGE.
Use $3.00 to pay for this sale?

Yes · No
```

The owner approved asking this question. It precedes the due-date question for the unpaid sale when CHANGE could pay for the sale.

The Yes branch and its confirmation below are owner-approved. The owner rejected the earlier proposed No branch that would preserve $4.80 CHANGE and create $3.00 CHIKWERETI. It must not be implemented.

- `Yes`: prepare the transaction using $3.00 of CHANGE. After confirmation, remaining CHANGE is $1.80 and new CHIKWERETI is $0.00. Cash received remains $0.00. This is spending customer money on goods, not a partial cash handback, so the no-partial-handback rule does not prohibit it.
- The original message implicitly indicates that available CHANGE pays for the sale. The Yes/No question confirms this interpretation; it is not a choice to keep CHANGE and take new credit instead.
- `No`: the proposed interpretation is not confirmed. Do not create CHIKWERETI, deduct CHANGE, save the sale, or ask for a debt due date as an automatic alternative. Seek correction or cancellation; the exact correction wording remains for review.

Owner-approved Yes-branch confirmation:

```text
Makoni — Sweets
3 × $1.00 = $3.00
Cash received: $0.00
CHANGE used: $3.00
CHANGE: $1.80

Save this transaction?
Confirm · Correct · Cancel
```

As in scenario 4, Yes proceeds to the detail confirmation. Only the final Confirm saves the sale and changes balances. Both the CHANGE-use question and the Yes-branch confirmation are owner-approved. No rejects the interpretation and must not produce the rejected combination of untouched CHANGE plus new CHIKWERETI.

### Scenario 6: owner-approved insufficient CHANGE interaction

Starting position for this isolated walkthrough: Makoni has $1.80 CHANGE and $0.00 CHIKWERETI. Vendor sends:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 0 dollars
```

Owner-approved question:

```text
Makoni has $1.80 CHANGE.
Use it towards this sale, leaving $8.40 CHIKWERETI?

Yes · No
```

On `Yes`, prepare use of the full $1.80 CHANGE against the $10.20 sale. The resulting CHANGE is $0.00 and CHIKWERETI is $8.40. The owner approved this exact due-date prompt, with the amount emphasised:

```text
When will Makoni pay?
CHIKWERETI: $8.40
```

The vendor can reply `Monday` or `Next Friday`, then MUSIKA presents the full confirmation. A new answer replaces the customer's captured due date; without a new answer, keep the previously captured date. If no previous date exists and none is supplied, allow final confirmation with the due date unspecified. Use this concise question-and-CHIKWERETI pattern for the due-date interaction rather than adding explanatory sale details to the question.

As with scenario 5, No does not create a debt while preserving the CHANGE. It leaves the interpretation unconfirmed and requires correction or cancellation. Only final Confirm saves the transaction and changes balances.

Proposed final detail confirmation for owner review:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $0.00
CHANGE used: $1.80
CHANGE: $0.00
CHIKWERETI: $8.40
Due: [newly supplied or previously captured date]

Save this transaction?
Confirm · Correct · Cancel
```

This isolated walkthrough has no opening CHIKWERETI. The original workbook row 10 also has $17.00 of existing debt, so its closing debt is $25.40 rather than $8.40. Keep those starting conditions distinct.

### Scenario 7: owner-approved new credit with existing CHIKWERETI

Starting position for this walkthrough: Makoni has $8.40 CHIKWERETI and $0.00 CHANGE. Vendor sends:

```text
Makoni - Sold - Sweets - 3x1 - Cash 0 dollars
```

MUSIKA asks:

```text
When will Makoni pay?
CHIKWERETI: $11.40
```

The question shows the full resulting CHIKWERETI ($8.40 existing plus $3.00 from this sale), not only the latest unpaid sale amount. A new answer updates the customer's due date for the full $11.40. Without a new answer, the previously captured date persists. Then show the transaction details for confirmation; only final Confirm saves it.

The owner approved this interaction. Its starting balance is the isolated walkthrough balance, not the original workbook's larger running total.

### Customer payment: owner-approved partial repayment

Starting position: Makoni has $11.40 CHIKWERETI, $0.00 CHANGE and a previously captured due date. There is no new sale. Vendor sends:

```text
Makoni - Paid - 5 dollars
```

Owner-approved confirmation:

```text
Makoni — Payment
Cash received: $5.00
CHIKWERETI: $6.40
Due: [previously captured date]

Save this transaction?
Confirm · Correct · Cancel
```

Emphasise the resulting CHIKWERETI amount. There is no new due-date question for this repayment; the captured date persists. Only final Confirm saves the payment and reduces CHIKWERETI. The owner subsequently clarified that later standalone payments settle oldest CHIKWERETI first even when sale details are mentioned; cash received with a sale settles that sale first and applies any remainder to the oldest CHIKWERETI.

### Customer payment: owner-approved full repayment

Continuing the partial-payment example, Makoni has $6.40 CHIKWERETI and $0.00 CHANGE. Vendor sends:

```text
Makoni - Paid - 6.40 dollars
```

Owner-approved confirmation:

```text
Makoni — Payment
Cash received: $6.40
CHIKWERETI: $0.00

Save this transaction?
Confirm · Correct · Cancel
```

Emphasise the zero CHIKWERETI amount. Omit the due-date line because nothing remains payable. This omission is a display rule, not an instruction to delete the previously captured date. Only final Confirm records the payment and settles the debt.

### Customer payment: owner-approved overpayment interaction

Alternative starting position: Makoni has $6.40 CHIKWERETI and $0.00 CHANGE, and pays $10.00. This branches from the outstanding $6.40 example rather than following the already settled example. Vendor sends:

```text
Makoni - Paid - 10 dollars
```

Prepare settlement of the full $6.40 CHIKWERETI, then ask:

```text
$3.60 CHANGE
Did you give it back?
Yes · No
```

The owner approved this interaction and the two outcomes:

- `Yes`: all $3.60 is returned; closing CHANGE is $0.00 and CHIKWERETI is $0.00.
- `No`: none is returned; closing CHANGE is $3.60 and CHIKWERETI is $0.00.

Both branches keep cash received at $10.00. Present the payment details and the resulting CHANGE for final confirmation, using the concise pattern approved for cash-sale change. Omit the due-date line because CHIKWERETI is settled. No partial handback is offered. Only final Confirm records the payment, settlement and handback outcome.

### CHANGE return: owner-approved full return

Continuing the overpayment's No branch, Makoni has $3.60 CHANGE and $0.00 CHIKWERETI. Later, the vendor returns the entire $3.60 and sends:

```text
Makoni - Returned - 3.60 dollars
```

Owner-approved confirmation:

```text
Makoni — CHANGE returned
Cash returned: $3.60
CHANGE: $0.00

Save this transaction?
Confirm · Correct · Cancel
```

Emphasise the resulting CHANGE amount. This records cash returned to the customer, not cash received from them. No extra handback question is needed in this approved example: `Returned` explicitly reports the full handback. Only final Confirm saves it and clears CHANGE. Partial cash handbacks remain unsupported. This single known CHANGE example does not resolve receipt matching when several receipts exist (O4).

### Mixed payment: owner-approved cash plus sufficient CHANGE

Separate starting position: Makoni has $4.80 CHANGE and $0.00 CHIKWERETI. Vendor sends:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars
```

The sale value is $10.20. Apply the $6.00 new cash to this purchase first, leaving $4.20 to fund. Owner-approved question:

```text
Makoni has $4.80 CHANGE.
Use $4.20 to pay the rest of this sale?
Yes · No
```

The owner approved the Yes outcome: use $4.20 CHANGE, leaving $0.60 CHANGE and no CHIKWERETI, then show the full transaction confirmation. Preserve cash received as $6.00; do not describe the CHANGE used as new cash received. Only final Confirm saves the sale and updates balances. As in the other CHANGE-use questions, No rejects the interpretation and requires correction, not an automatic debt-with-CHANGE fallback.

Exact confirmation wording remains to be reviewed; the question and amounts above are approved.

### Mixed payment: owner-approved cash plus insufficient CHANGE

Separate starting position: Makoni has $1.80 CHANGE and $0.00 CHIKWERETI. Vendor sends:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars
```

The $10.20 sale receives $6.00 new cash, leaving $4.20 to fund. Owner-approved question:

```text
Makoni has $1.80 CHANGE.
Use it towards this sale, leaving $2.40 CHIKWERETI?
Yes · No
```

After Yes, prepare use of the full $1.80 CHANGE, leaving $0.00 CHANGE and $2.40 CHIKWERETI. Ask:

```text
When will Makoni pay?
CHIKWERETI: $2.40
```

Emphasise the CHIKWERETI amount. A new due-date answer replaces the captured date; otherwise the previous date persists. Then present the full details for final confirmation. Only final Confirm records the $6.00 cash received, $1.80 CHANGE used and $2.40 unpaid. No rejects the interpretation and requires correction or cancellation; it must not automatically retain CHANGE and create debt.

The owner approved this interaction. Exact final detail wording remains to be reviewed.

### Named sale plus old debt: owner-approved excess-cash interaction

Separate starting position: Makoni has $8.00 CHIKWERETI and $0.00 CHANGE. Vendor sends:

```text
Makoni - Sold - Sweets - 3x1 - Cash 15 dollars
```

The owner approved applying the $15.00 in this order: $3.00 pays the named new sale, $8.00 clears the existing CHIKWERETI oldest first, and $4.00 remains. Ask:

```text
$4.00 CHANGE
Did you give it back?
Yes · No
```

Yes means all $4.00 was returned, leaving $0.00 CHANGE and $0.00 CHIKWERETI. No means none was returned, leaving $4.00 CHANGE and $0.00 CHIKWERETI. Cash received remains $15.00 in both branches. Present the full transaction details for final Confirm before recording the sale, repayment and change treatment. Exact final wording for showing the old-debt settlement remains for review.

This approved flow clears old CHIKWERETI before creating CHANGE. Older workbook cases creating CHANGE while CHIKWERETI remains are source history and cannot override this approved allocation.

### Later payment across credits: owner-approved worked confirmation

Makoni has an earliest credit of $5.00, followed by two separate $2.00 Nails credits. Total CHIKWERETI is $9.00. Vendor sends:

```text
Makoni - Paid - 3 dollars
```

Apply the $3.00 to the earliest $5.00 credit, leaving $2.00 there. Both later Nails credits remain $2.00 each. The owner approved this allocation and the following confirmation:

```text
Makoni — Payment
Cash received: $3.00
CHIKWERETI: $6.00
Due: [previously captured date]

Save this transaction?
Confirm · Correct · Cancel
```

Emphasise the resulting CHIKWERETI. Only final Confirm saves the payment. Do not substitute the rejected allocation that pays the Nails credits first.

### First credit with no due date: owner-approved permission

For Makoni's first credit purchase, no previous due date exists. Vendor sends `Makoni - Sold - Nails - 5x2 - Cash 0 dollars`. MUSIKA asks:

```text
When will Makoni pay?
CHIKWERETI: $10.00
```

The owner permits final confirmation if the vendor supplies no date. Keep the due date unspecified instead of inventing a date or requiring the transaction to remain pending for a date. This does not bypass final Confirm. Display `Due: Not specified` when no captured date exists. The owner specified clickable Enter date and Skip buttons for the question, rather than requiring a typed skip command.

### Due-date controls: owner-approved clickable UI

Present the concise question and two clickable buttons:

```text
When will Makoni pay?
CHIKWERETI: [resulting outstanding amount]

[Enter date]  [Skip]
```

- Enter date opens the date-entry step. Continue to accept the owner's specified natural replies such as Monday or Next Friday. A new supplied date replaces the customer's previous date and is shown as a concrete calendar date in final confirmation. If the named weekday is the current day, use its following occurrence, not today; `Today` means the current day. Other date questions remain O5.
- Skip proceeds to final transaction confirmation. Keep the previously captured date when one exists; otherwise show `Due: Not specified`.
- Neither button saves the transaction. Only final Confirm does so. A lack of response is not the same as selecting Skip and must not trigger automatic progression or saving.

The owner explicitly requested clickable UI for both controls. No calendar-picker requirement or restriction to manually typed date formats is implied by that decision.

### Weekday due dates: owner-approved current-day distinction

For the Friday 16 October 2026 example, the owner confirmed:

| Vendor's reply | Calendar date shown in confirmation |
| --- | --- |
| Today | Friday 16 October 2026 |
| Monday | Monday 19 October 2026 |
| Friday | Friday 23 October 2026 |
| Next Friday | Friday 23 October 2026 |

The specific owner correction was `Next friday, today is today`: a weekday name matching the current weekday means its following occurrence, seven days later. Do not interpret the bare weekday as today. Show the resolved calendar date before final Confirm. This example does not decide how `Next Friday` is interpreted on a different weekday or how backdated transaction dates affect relative dates.

### Correct: owner-approved whole-transaction re-entry

When the vendor selects Correct on a pending confirmation, ask them to re-enter the complete transaction in the same message format, correctly this time. Do not offer an Item/Quantity/Price/Cash received editing menu, individual field editing or a correction wizard.

Proposed short prompt:

```text
Please enter the transaction again with the correct details.
```

The replacement message goes through the normal interpretation, applicable questions and final confirmation. Recalculate from the replacement message rather than keeping stale amounts or handback answers from the rejected draft. Nothing from the old unconfirmed draft is saved, and selecting Correct must not change saved customer balances.

This owner-approved rule concerns correction before saving. It does not decide how already confirmed transactions may be corrected or reversed; that remains a separate workflow.

### Cancel: owner-approved discard action

When the vendor selects Cancel, discard the pending transaction and reply:

```text
Transaction cancelled.
```

Do not save any part of the pending event or change saved records, customer balances or the saved due date. This discards an unconfirmed draft; it does not delete a previously confirmed transaction. Do not introduce additional menus or cancellation questions in this approved interaction.

### Confirm: owner-approved save acknowledgement

After final Confirm successfully saves the transaction, reply exactly:

```text
Transaction saved.
```

Then wait for the vendor's next transaction. Do not add a menu, another question, a duplicate transaction summary or extra confirmation steps. This replaces the earlier draft cash-sale acknowledgement mentioning a settled account. Only send the acknowledgement after saving succeeds; selecting a preliminary Yes/No answer does not save the transaction.

### Remaining conversation drafts

The source message style is a reference language for review, not a claim about commands supported by the current backend:

```text
Makoni - Sold - Nails - 6x2 - Cash 5 - Credit 14 Jul
Makoni - Paid - 3 - Sale 19 Jul - Nails - Qty 1
Makoni - Returned - 2 - Payment 23 Jul
```

A successful interpretation should show the vendor:

1. Customer and action.
2. Goods and sale value, if applicable.
3. Cash received or returned.
4. The allocation: current purchase, old debt, held money used or new money held.
5. New credit and its due date, if applicable.
6. The resulting debt and held balances.
7. An explicit choice to confirm, correct or cancel.

Example using the owner's newly confirmed default:

```text
Makoni — new sale: $3.00
Cash received: $5.00
Applied to this sale: $3.00
Applied to previous debt: $2.00
After saving: Makoni owes $6.00; held money $0.00.
Confirm, correct or cancel?
```

Example where held change is explicitly requested, starting from the workbook row 7 balances:

```text
Makoni — Soap: 6 × $1.70 = $10.20
Cash received: $15.00
Applied to this sale: $10.20
New change held: $4.80
Previous debt unchanged: $17.00
After saving: Makoni owes $17.00; held money $4.80.
Confirm, correct or cancel?
```

Clarification examples:

- `I cannot find Makoni's customer account. Please check the customer name.`
- `Makoni has $4.80 CHANGE. Return the full $4.80, or leave it outstanding. Partial handbacks are not supported.`
- `You entered $5 cash, but the requested allocations use $6. Please correct the allocation.`
- `What date is the new credit due?`

Further acceptance cases should check cancellation, correction before confirmation, duplicate message delivery, matching the wrong customer, invalid zero/negative amounts (with zero cash received explicitly allowed), spending more held money than available, replacement of the customer due date by a new answer, and persistence of the captured date when unanswered or after repayment. These are specification checks to prepare, not new tests or backend changes made by this document.

## 9. Decisions still open

| ID | Question | Why it matters |
| --- | --- | --- |
| O3 | If cash remains after the current purchase and all old debt are settled, but the message does not say `Change Held`, should MUSIKA ask whether change was returned or kept? | Money held belongs to the customer; its treatment must be explicit. |
| O4 | Are named receipt references mandatory for held-money returns, and how should a return spanning several receipts be allocated? | The examples name a payment date, but the workbook only computes an aggregate held balance. |
| O5 | How should `Next Friday` be interpreted on other weekdays? Also decide short dates without a year, backdated entries, duplicate customer names and mixed currencies. | On a Friday, the owner confirmed Friday/Next Friday means the following Friday, Today means today, and Monday means the coming Monday. Broader relative-date cases remain to be reviewed. |
| O9 | How should other source cases showing both CHANGE and CHIKWERETI be reconciled with the owner's rejection of that outcome in scenario 5? | The $0-cash sale implicitly uses sufficient available CHANGE. The workbook's older dual-positive rows must not be promoted to approved product rules without reviewing those other contexts. |

Resolved O1: the owner approved mixed cash plus CHANGE both with sufficient CHANGE and with a remaining CHIKWERETI shortfall; the latter leads to the concise due-date question and then final confirmation.

Resolved O7: use clickable Enter date and Skip controls. Skip keeps an existing date or leaves it unspecified when none exists, and proceeds to final confirmation without saving automatically.

Resolved O2/O6: a later standalone repayment settles oldest CHIKWERETI first, including the discussed payment message that names a previous sale. Cash received with a sale settles that sale first, then applies any remainder to oldest CHIKWERETI. The owner rejected the proposed later-payment allocation restricted to the two named Nails sales.

Resolved O8: the owner confirmed that the no-partial-handback rule also applies to later returns of previously recorded CHANGE. Source scenarios 17–18 are superseded where they require partial cash returns. Partial repayments of CHIKWERETI are unaffected.

Expenses, stock movements, goods returns, discounts, corrections of saved transactions, and reporting beyond this customer register can be specified separately when examples are supplied. Their absence here does not remove existing backend features.

## 10. Review outcome required before implementation

The owner's completed conversation simulation is preserved in [the accepted walkthrough](accepted-walkthrough.md). It contains four confirmed events, corrected drafts, due-date carry-forward and the independently reconciled closing balances. This is an acceptance reference, not evidence of a live WhatsApp or database test.

The owner approved the core conversation for [correcting a saved transaction](saved-transaction-corrections.md): reply to the original with Correct, re-enter the full transaction, review and Confirm, then acknowledge `Transaction corrected.` Cancel leaves the saved original unchanged. This is documentation only. The numerical worked example and cases involving subsequent dependent transactions remain for review. Correction before saving remains the already approved simple re-entry flow.

Review the customer balances, allocation precedence, sale matching and proposed confirmation wording. Resolve the open decisions relevant to the next workflow. Only then decide how this specification maps to the intentionally built backend. This document authorises no backend expansion by itself.
