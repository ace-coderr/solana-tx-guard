---
name: tx-guard
description: Analyze a Solana transaction for drain/takeover risk before signing.
argument-hint: <base64-tx> [rpc-url]
---

Analyze the Solana transaction provided in $ARGUMENTS for pre-sign risk.

Steps:
1. Treat the first argument as a base64-encoded serialized transaction. If a
   second argument is present, use it as the RPC URL for simulation + lookup
   table resolution.
2. Run the bundled analyzer:
   - `npx tx-guard "<base64-tx>" --json` (add `--rpc "<rpc-url>"` if provided).
3. Report, in this order:
   - the verdict (BLOCK / WARN / ALLOW) and risk score,
   - each finding: severity, what it does, why it matters (one or two sentences),
   - the standing caveats.
4. Give a clear recommendation. Never say "safe" — say "no static red flags"
   plus the caveats. Never recommend signing through a failed simulation.

If no transaction is supplied, ask the user to paste the base64 serialized
transaction (signed or unsigned, legacy or v0).
