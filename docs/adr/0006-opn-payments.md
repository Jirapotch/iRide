# ADR 0006: Opn payments

- Status: Accepted
- Date: 2026-08-27

## Decision

Use Opn for THB card/3DS and PromptPay payments. The client may eventually receive an Opn public key; secret and webhook credentials remain server-only. Webhooks cannot directly establish financial truth: the API must retrieve the charge from Opn before changing order state.

## Consequences

Payment commands and webhooks require idempotency. Amounts use integer satang, and ledger entries—not mutable balances—become the financial source of truth.
