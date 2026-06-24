# Why simulation is necessary but not sufficient

Wallets and dApps lean heavily on transaction simulation to preview "what will
happen." Simulation is genuinely useful — but treating a clean simulation as a
safety guarantee is the mistake that funds drains. Two reasons, both exploited in
the wild.

## 1. The simulation is truthful but becomes stale (TOCTOU / upgrade swap)

Solana programs are upgradeable by default. An attacker can:

1. Present a transaction that calls a benign function. The wallet simulates it
   against the *current* program code → looks safe → the user signs.
2. The attacker does **not** broadcast immediately. They upgrade the program so
   the same function now contains drain logic.
3. The attacker broadcasts the already-signed transaction. It executes against
   the new code and drains the wallet.

The simulation was accurate at signing time; the program changed underneath it.
No simulation can predict what a program will *become*. This is why
`program-reputation.md` treats upgradeable/recently-upgraded programs as a risk
signal, and why a clean verdict is always qualified.

## 2. The dangerous instruction moves nothing to simulate

Most wallet simulations summarize **balance and token deltas**. The takeover
instructions in `authority-attacks.md` (owner reassignment, SetAuthority,
delegate approve) deliberately move zero tokens during the signed transaction —
the theft happens later. A delta-based preview shows "nothing transferred," and
the user signs with false confidence. Static intent analysis, not delta
analysis, is what catches these.

## 3. Failed simulation is weaponized

A known trick triggers a deliberate "Transaction reverted / simulation error"
and tells the user to "sign all to verify." The "verification" is actually an
unlimited-spend approval or authority change. **Rule: never advise signing
through a failed simulation.** The analyzer adds this caveat automatically when
an RPC simulation returns an error.

## How tx-guard combines the two

- Static intent analysis (the rules engine) is the **primary** defense and runs
  with no RPC.
- Simulation (`--rpc`) is **corroboration**: it resolves lookup-table accounts
  and catches runtime failures, but never upgrades a verdict to "guaranteed
  safe."
- The verdict always carries caveats stating these limits explicitly, so neither
  a human nor an agent can read "allow" as "safe."
