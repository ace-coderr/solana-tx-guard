# Durable nonces & pre-signed transaction replay

## What a durable nonce changes

A normal Solana transaction expires when its recent blockhash ages out (roughly
60–90 seconds). A **durable nonce** replaces the blockhash with a stored nonce
value, so a signed transaction stays valid indefinitely until the nonce is
advanced. Legitimate uses exist (offline signing, scheduled/multisig flows), but
the same property makes a signed transaction a long-lived, replayable artifact.

Detection: the presence of a System `AdvanceNonceAccount` instruction (usually
the first instruction) means the transaction is nonce-based. The analyzer raises
`DURABLE_NONCE`.

## Why it is dangerous to pre-sign

Because the transaction does not expire, an attacker who obtains signed
durable-nonce transactions — or who socially engineers approvals for them — can
hold them and execute later, against future on-chain state, bypassing checks
that assumed prompt execution.

This is exactly the mechanism behind the **2026 Drift drain (~$270M)**: the
attacker secured a small number of misleading multisig approvals, used durable
nonces to pre-sign administrative transfers that stayed valid for over a week,
then executed them in minutes to seize protocol-level control. No code bug, no
stolen key — a legitimate feature abused through pre-signing.

## Severity logic

- Durable nonce on an otherwise mundane transfer → **medium** (be aware you are
  signing something replayable later).
- Durable nonce **combined with** an authority/ownership change, program upgrade,
  or admin transfer → **high**. The combination is the acute pattern: a
  long-lived signed instruction that can change control.

## Guidance to surface

1. Confirm the signer *intends* offline/deferred execution. If they expect the
   transaction to run now, a durable nonce is a red flag.
2. For teams/multisigs: treat durable-nonce admin transactions as high-scrutiny;
   verify what each pre-signed transaction does, not just that "an approval was
   requested."
3. Track and rotate nonce accounts; an unexpectedly old or unfamiliar nonce
   account is suspicious.
