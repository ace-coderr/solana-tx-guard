# Gating an autonomous agent

Autonomous agents are the highest-risk signer: they sign without a human reading
the prompt, and "agentic drainers" specifically target them. A signing agent
must never call `sendTransaction` without first passing the transaction through a
guard and a policy.

## The gate

Run the analyzer in JSON mode (or call `analyzeTransaction` directly) on every
transaction *before* signing. Use `action` as the gate and the exit code in shell
pipelines (`1` == block).

```ts
import { analyzeTransaction } from "@solana-tx-guard/analyzer";

async function guardedSign(base64Tx: string, signFn: (tx: string) => Promise<string>) {
  const verdict = await analyzeTransaction(base64Tx, {
    rpcUrl: process.env.RPC_URL,
    policy: { recipientAllowlist: ALLOWED_RECIPIENTS },
  });

  if (verdict.action === "block") {
    throw new Error(
      `tx-guard blocked: ${verdict.findings.map((f) => f.code).join(", ")}`,
    );
  }
  if (verdict.action === "warn") {
    // Do not silently proceed. Escalate to a human, or refuse,
    // depending on the agent's autonomy policy.
    await requestHumanApproval(verdict);
  }
  return signFn(base64Tx);
}
```

## Policy layer (defense in depth)

The analyzer enforces a `recipientAllowlist` and you should layer your own:

- **Per-transaction max value** and **rolling daily cap** (track spend out of
  band; a single safe-looking tx can still be one of many).
- **Recipient allowlist** for payment agents; deny unknown destinations by
  default.
- **Program allowlist** — restrict which programs the agent may ever call.
- **Block all authority/ownership instructions** for agents that only need to pay
  (an agent that pays invoices never needs to call `SetAuthority` or `Assign`;
  treat any such instruction as an immediate block regardless of score).

## Principles

1. **Default deny on uncertainty.** `warn` is not `allow`; route it to a human or
   refuse.
2. **The agent must not be able to override its own block.** The gate lives
   outside the model's reasoning, in code.
3. **Log every verdict** with the transaction and findings for audit.
4. **A clean verdict is not consent** — the policy ceiling (caps, allowlists)
   still applies on top.
