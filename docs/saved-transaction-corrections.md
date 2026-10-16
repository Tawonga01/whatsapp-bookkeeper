# Correcting a saved transaction

Core interaction approved by the owner — 16 October 2026. The owner subsequently authorised implementation. Reply-based correction, full-message re-entry, confirmation and revision history are implemented for the latest affected-customer ledger entry and tested with PostgreSQL. The further dependent-transaction cases below remain for review; they are blocked rather than guessed. See [implementation notes](backend-implementation.md).

## Owner-approved interaction

Follow the owner's preference for full-message re-entry and minimal UI. Do not introduce a field-editing menu.

1. Vendor replies to the original transaction message with `Correct`. A reply identifies the saved transaction without requiring a typed record number.
2. MUSIKA shows `Please enter the transaction again with the correct details.`
3. Vendor enters the complete replacement transaction in the normal format.
4. MUSIKA asks any applicable normal questions and presents the replacement details for final confirmation.
5. Confirm applies the correction and acknowledges `Transaction corrected.` The original record and its replacement remain linked in the transaction history; the result counts as one corrected transaction, not two sales or payments.
6. Correct at the replacement confirmation asks for full-message re-entry again. Cancel abandons the correction and leaves the original saved transaction unchanged.

No saved balances change while the replacement is being prepared. Do not delete the saved original as soon as the vendor requests Correct. Do not acknowledge a correction before it has been saved successfully.

## Isolated example: most recent sale, no later transactions

The vendor previously confirmed:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 7 dollars
```

The account has $3.20 CHIKWERETI, $0.00 CHANGE and a captured Sunday 18 October 2026 due date. The vendor discovers they actually received $6.00, not $7.00. This is a recording mistake, not a new payment or money being returned now.

Vendor replies to the saved sale with:

```text
Correct
```

MUSIKA:

```text
Please enter the transaction again with the correct details.
```

Vendor:

```text
Makoni - Sold - Soap - 6x1.70 - Cash 6 dollars
```

Run the normal due-date interaction. Enter date may replace the date; Skip retains the captured Sunday. Proposed final details after Skip:

```text
Makoni — Soap
6 × $1.70 = $10.20
Cash received: $6.00
CHIKWERETI: $4.20
Due: Sunday, 18 October 2026

Save this correction?
Confirm · Correct · Cancel
```

After Confirm:

```text
Transaction corrected.
```

Expected result: the one sale remains $10.20, corrected cash received is $6.00 and CHIKWERETI becomes $4.20. Do not record a second sale, a new $6.00 cash receipt in addition to $7.00, or an actual $1.00 refund. Cancel leaves the original $7.00 receipt and $3.20 CHIKWERETI intact.

## Remaining details and cases to review

- Replying to the original with Correct, full-message re-entry, final Confirm, `Transaction corrected.`, and Cancel retaining the original are approved. If the original cannot be identified unambiguously, the proposed fallback is to ask for that message rather than guessing the latest transaction.
- Review the numerical example's exact confirmation heading `Save this correction?` when testing the full interaction.
- Decide how to handle an older transaction when subsequent sales, repayments or CHANGE spending depend on it. Recomputing those balances may produce a different handback or debt outcome; do not silently invent physical money movements or approve this broader case from the simple example.
- Decide whether relative dates in a replacement are interpreted against the original transaction date or the correction date, and whether a corrected due-date answer changes the current customer date when newer answers exist.
- Distinguish correcting a data-entry mistake from an actual later goods return, refund, payment or cancellation. Those are different business events.

This approval does not authorise backend changes. It approves the core conversation; the worked example and broader dependent-transaction cases can be tested next.
