# MUSIKA ACCOUNTANT accepted conversation walkthrough

Reference example from the owner's in-chat walkthrough, 16 October 2026.

This was a conversation simulation, not a live WhatsApp or database test. Its `Transaction saved.` replies mean confirmed events within the simulation. The owner approved the completed walkthrough. No backend source was changed.

Implementation follow-up: this exact conversation is now covered by automated bot tests and PostgreSQL integration tests in the backend update. See [implementation notes](backend-implementation.md). The original human walkthrough and subsequent automated verification are distinct evidence.

## Starting position

Makoni has $0.00 CHIKWERETI, $0.00 CHANGE and no captured due date. The reference day is Friday 16 October 2026. Sunday resolves to 18 October 2026.

## Confirmed events and expected balances

Only the four final confirmations below change the simulated register. Values are dollars.

| Event | Description | Sale value | Cash received | Cash returned | Closing CHIKWERETI | Closing CHANGE | Due date displayed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| T1 | Soap, 6 × 1.70; corrected cash amount is 7.00 | 10.20 | 7.00 | 0.00 | 3.20 | 0.00 | Sunday 18 October 2026 |
| T2 | Sweets, 3 × 1; no cash, Skip due-date entry | 3.00 | 0.00 | 0.00 | 6.20 | 0.00 | Sunday 18 October 2026 |
| T3 | Payment of 10.00; excess 3.80 returned in full | 0.00 | 10.00 | 3.80 | 0.00 | 0.00 | Omitted |
| T4 | Soap, 6 × 1.70; cash 15.00, difference returned in full | 10.20 | 15.00 | 4.80 | 0.00 | 0.00 | Omitted |

## T1: corrected sale before saving

1. Vendor: `Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars`.
2. MUSIKA asks `When will Makoni pay?` and shows `CHIKWERETI: $4.20`, with clickable Enter date and Skip controls.
3. Vendor: `Sunday`.
4. MUSIKA presents the sale, $6.00 cash received, $4.20 CHIKWERETI and Sunday 18 October 2026, with Confirm/Correct/Cancel.
5. Vendor: `Correct`.
6. MUSIKA: `Please enter the transaction again with the correct details.`
7. Vendor: `Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars`.
8. MUSIKA asks `When will Makoni pay?`, showing $3.20 CHIKWERETI.
9. Vendor: `sunday`.
10. MUSIKA presents:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $7.00
CHIKWERETI: $3.20
Due: Sunday, 18 October 2026

Save this transaction?
Confirm · Correct · Cancel
```

11. Vendor: `confirm`.
12. MUSIKA: `Transaction saved.`

Expected: one sale, not two. The rejected $6.00 draft contributes no sale, cash receipt or debt.

## T2: additional credit and Skip

1. Vendor: `Makoni - Sold - Sweets - 3x1 - Cash 0 dollars`.
2. MUSIKA asks `When will Makoni pay?`, showing total CHIKWERETI of $6.20, with Enter date/Skip.
3. Vendor: `skip`.
4. MUSIKA presents the $3.00 sale, $0.00 cash received, $6.20 total CHIKWERETI and the existing Sunday 18 October 2026 due date, with Confirm/Correct/Cancel.
5. Vendor: `confirm`.
6. MUSIKA: `Transaction saved.`

Expected: debt grows by $3.00; Skip preserves Sunday rather than clearing or inventing a date.

## T3: overpayment with corrected handback answer

1. Vendor: `Makoni - Paid - 10 dollars`.
2. MUSIKA: `$3.80 CHANGE` / `Did you give it back?` / Yes/No.
3. Vendor: `NO`.
4. MUSIKA presents Makoni — Payment, $10.00 cash received and $3.80 CHANGE, with Confirm/Correct/Cancel.
5. Vendor: `correct`.
6. MUSIKA: `Please enter the transaction again with the correct details.`
7. Vendor re-enters: `Makoni - Paid - 10 dollars`.
8. MUSIKA asks the $3.80 handback question again.
9. Vendor: `yes`.
10. MUSIKA presents:

```text
Makoni — Payment
Cash received: $10.00
CHANGE: $0.00

Save this transaction?
Confirm · Correct · Cancel
```

11. Vendor: `confirm`.
12. MUSIKA: `Transaction saved.`

Expected: one $10.00 payment, settling $6.20 oldest credit first and returning $3.80. The abandoned No answer never creates saved CHANGE. With T1 before T2, both credits are fully settled.

## T4: cash sale with full handback

1. Vendor: `Makoni - Sold - Soap - 6x1.70 - Cash 15 dollars`.
2. MUSIKA: `$4.80 CHANGE` / `Did you give it back?` / Yes/No.
3. Vendor: `yes`.
4. MUSIKA presents:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $15.00
CHANGE: $0.00

Save this transaction?
Confirm · Correct · Cancel
```

5. Vendor typed `comfirm` in the walkthrough; it was treated as Confirm and acknowledged `Transaction saved.` Record this as observed conversation behaviour. A general typo-handling rule has not been agreed separately.

Expected: a $10.20 sale, $15.00 received and $4.80 returned in full. No new CHIKWERETI or CHANGE remains.

## Independent arithmetic checks

- Sales: $10.20 + $3.00 + $10.20 = $23.40.
- Cash received: $7.00 + $0.00 + $10.00 + $15.00 = $32.00.
- Cash returned: $3.80 + $4.80 = $8.60.
- Net cash retained: $32.00 − $8.60 = $23.40.
- Closing CHIKWERETI: $0.00. Closing CHANGE: $0.00.
- Do not add the $10.00 debt payment to sale revenue. It settles sales already recorded.
- The three confirmed sales and one payment are the only saved events. Draft re-entry and Yes/No answers are not additional money movements.

Cancel, partial CHANGE-return rejection, missing-cash clarification, duplicate names and correction after saving were not exercised in this walkthrough. Their requirements or proposals are separate from this accepted example.
