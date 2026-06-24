# Using the analyzer

The skill ships a runnable analyzer in `analyzer/`. Prefer it over hand-reasoning
about raw transaction bytes.

## Install / build

```bash
cd analyzer
npm install
npm run build      # compiles to dist/ (provides the tx-guard bin)
npm test           # runs the attack/benign fixtures
```

## CLI

```bash
# human-readable review
npx tx-guard <base64-tx>

# add simulation + lookup-table resolution
npx tx-guard <base64-tx> --rpc https://your-rpc-endpoint

# machine-readable for agents/scripts (exit code 1 == block)
npx tx-guard <base64-tx> --json

# enforce a recipient allowlist
npx tx-guard <base64-tx> --allow Addr1,Addr2
```

Input is a **base64-encoded serialized transaction** (signed or unsigned). Both
legacy and v0 transactions are supported.

## Library

```ts
import { analyzeTransaction } from "@solana-tx-guard/analyzer";

const verdict = await analyzeTransaction(base64Tx, {
  rpcUrl: "https://your-rpc-endpoint",      // optional
  policy: { recipientAllowlist: ["..."] },  // optional
});

verdict.action;     // "block" | "warn" | "allow"
verdict.riskScore;  // 0..100
verdict.findings;   // [{ code, severity, title, detail, ixIndex, accounts }]
verdict.facts;      // decoded instructions, fee payer, ALT usage, ...
verdict.caveats;    // standing limits — always show these
```

## Verdict mapping

| action | meaning | what to do |
| --- | --- | --- |
| `block` | a critical finding or score ≥ 70 | do not sign; show critical findings |
| `warn` | score 25–69 | require explicit human confirmation |
| `allow` | no static red flags | proceed, but the caveats still hold |

## Extending

- **Reputation feed:** populate `KNOWN_MALICIOUS` / load a live feed in
  `src/programs.ts` (see `program-reputation.md`).
- **New rules:** add to `evaluate()` in `src/rules.ts`; return a `Finding` with a
  stable `code` and a severity. Add a fixture in `test/fixtures.ts`.
- **New decoders:** extend `decodeOp()` in `src/decode.ts` for additional
  programs/instructions you want named precisely.
