---
name: solana-tx-guard
description: >-
  Pre-sign transaction safety for Solana wallets and autonomous agents. Decodes
  what a transaction actually does, flags account-takeover and drain patterns
  that balance simulation cannot see (owner reassignment, SetAuthority,
  unlimited delegate, durable-nonce replay, program-upgrade swaps), and returns
  an allow/warn/block verdict. Use whenever you are about to sign, approve, or
  let an agent submit a Solana transaction, review a serialized/base64 tx, or
  add a signing gate to an agent loop.
triggers:
  - sign / approve / submit a Solana transaction
  - "is this transaction safe", "what does this tx do", "decode this tx"
  - wallet drainer, account takeover, setAuthority, delegate approval
  - durable nonce, pre-signed transaction, TOCTOU
  - gate / guard an agent's signing or payment loop
license: MIT
---

# solana-tx-guard

Runtime, pre-sign risk analysis for Solana. The existing Solana security tooling
audits **program source code**. This skill defends the other side: the
**transaction a user or agent is about to sign**. Most modern drains move zero
tokens at sign time, so wallet "balance change" simulation shows nothing — this
skill inspects *intent*.

## Golden rules (load these always)

1. **Simulation is necessary but never sufficient.** A clean simulation does not
   mean safe. See `simulation-limits.md`.
2. **Never "sign anyway" on a failed simulation.** That prompt is itself a known
   drainer trick.
3. **Zero token movement is not safety.** The dangerous instructions
   (ownership/authority changes) are invisible to balance diffs.
4. **A clean verdict downgrades, never eliminates, risk** when upgradeable
   programs or durable nonces are involved.

## Routing — load only what the task needs

| If the task is… | Read |
| --- | --- |
| Understand the attack classes / triage a finding | `authority-attacks.md` |
| Explain why a "safe" simulation can still drain | `simulation-limits.md` |
| A durable-nonce / pre-signed / replay question | `durable-nonce.md` |
| Judge whether a called program is trustworthy | `program-reputation.md` |
| Recipient poisoning, lookalikes, lookup tables | `address-checks.md` |
| Wire the guard into an autonomous agent | `agent-gating.md` |
| Actually run the analyzer (CLI / library) | `using-the-analyzer.md` |
| SDK links, feeds, references | `resources.md` |

## Fast path

To analyze a serialized transaction, use the bundled analyzer rather than
reasoning about raw bytes by hand:

```bash
# human review
npx tx-guard <base64-tx> --rpc <rpc-url>
# agent gate (machine-readable, exit code 1 == block)
npx tx-guard <base64-tx> --json
```

Then map the verdict:

- `block` → do not sign. Surface the critical findings.
- `warn` → require explicit human confirmation; show each finding.
- `allow` → no static red flags found (still subject to the golden rules).

If you only have a transaction **signature** (already on-chain) rather than an
unsigned tx, you are doing post-mortem forensics, not pre-sign defense — fetch
the tx and explain what happened, but say clearly that prevention needed the
pre-sign check.

## What this skill will not do

- It will not tell a user a transaction is "safe" with certainty. The honest
  output is "no static red flags" plus the standing caveats.
- It will not auto-approve on behalf of a user to be "helpful."
- It is not a substitute for a program audit (`solana-auditor` / Trail of Bits
  cover program source).
