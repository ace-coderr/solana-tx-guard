# solana-tx-guard

**Pre-sign transaction safety for Solana wallets and autonomous agents.**

A Claude Code / agent skill that inspects a transaction *before it is signed*,
decodes what it actually does, and returns an `allow` / `warn` / `block` verdict
with reasons — catching the account-takeover and drain patterns that wallet
balance-simulation cannot see.

> Built for the [Solana AI Kit](https://github.com/solanabr/solana-ai-kit).

## The problem

Solana's security tooling audits **program source code** (Trail of Bits,
vulnerability scanners, auditor skills). Almost nothing defends the other side of
the attack surface: **the transaction a user or agent is about to sign.**

And the dangerous attacks are invisible to the standard defense. Wallets preview
"balance changes," but the modern drainers move *zero tokens at sign time*:

- A hidden System `Assign` silently reassigns your account's owner to an attacker
  program. Simulation shows nothing moved — yet your account is gone.
- `SetAuthority(AccountOwner)` hands a token account to a new owner who drains it
  later.
- `Approve` grants an unlimited delegate that drains in a separate transaction.
- A **durable nonce** pre-signs a transaction that stays valid for days — the
  mechanism behind the 2026 Drift drain (~$270M).
- A program is **upgraded between signing and execution** (TOCTOU), so a tx that
  simulated safe executes malicious code.

"Agentic drainers" now target autonomous agents specifically, because agents sign
without a human reading the prompt. An agent kit with no pre-sign defense is a
glaring hole. This fills it.

## What it does

- **Decodes intent**, not just balance deltas — legacy + v0 transactions.
- **Flags the takeover classes** balance-diff simulation misses: owner
  reassignment, token authority/ownership transfer, unlimited delegate, account
  close-to-third-party, program-upgrade-authority change, durable-nonce replay,
  lookup-table-obscured accounts, known-malicious addresses.
- **Optional RPC simulation** that corroborates but never upgrades a verdict to
  "guaranteed safe" — with the failed-simulation phishing trap handled.
- **Agent gate**: machine-readable JSON verdict + non-zero exit on `block`, plus
  a policy layer (recipient allowlist; designed for spend caps / program
  allowlists on top).
- **Honest by construction**: never says "safe," always carries the standing
  caveats.

It is **not** a program audit, and it does not duplicate one — see
`skill/resources.md` for how it complements `solana-auditor` / Trail of Bits.

## Quick start

```bash
git clone https://github.com/<you>/solana-tx-guard
cd solana-tx-guard
./install.sh            # installs the skill to ~/.claude/skills/

# build the analyzer
cd analyzer && npm install && npm run build

# analyze a transaction
npx tx-guard <base64-tx>                 # human review
npx tx-guard <base64-tx> --json          # agent gate (exit 1 == block)
npx tx-guard <base64-tx> --rpc <rpc-url> # + simulation & ALT resolution
```

Example (a transfer with a hidden owner-reassignment):

```
 BLOCK   risk score 100/100
[CRITICAL] Account ownership is being reassigned  (OWNER_REASSIGNMENT)
   A System Assign hands control of an existing account to another program.
   This moves zero tokens at sign time, so balance simulation shows nothing —
   but the new owner can drain the account afterward.
```

## Repository structure

```
solana-tx-guard/
├── CLAUDE.md                     # agent configuration
├── README.md
├── LICENSE                       # MIT
├── install.sh / install-custom.sh
├── skill/
│   ├── SKILL.md                  # progressive entry point (routes below)
│   ├── authority-attacks.md      # the attack taxonomy + triage
│   ├── simulation-limits.md      # why a clean sim is not safety
│   ├── durable-nonce.md          # pre-sign / replay (Drift vector)
│   ├── program-reputation.md     # upgradeable programs, verified builds
│   ├── address-checks.md         # poisoning, lookalikes, lookup tables
│   ├── agent-gating.md           # wiring the guard into an agent loop
│   ├── using-the-analyzer.md     # CLI + library usage
│   └── resources.md
├── agents/   tx-security-analyst.md
├── commands/ tx-guard.md
├── rules/    tx-guard-rules.md
└── analyzer/                     # runnable TS analyzer (tested)
    ├── src/      decode · rules · simulate · analyze · cli
    └── test/     attack & benign fixtures
```

The skill is **progressive**: `SKILL.md` is small and routes to a focused file
only when the task needs it, so context loads on demand.

## Tests

```bash
cd analyzer && npm test
```

Fixtures construct real benign and attack transactions in-memory and assert the
verdict (benign → allow; owner-reassignment and token-owner-transfer → block;
unlimited delegate → warn).

## Installation options

| | `install.sh` | `install-custom.sh` |
| --- | --- | --- |
| Prompts | minimal | full menu |
| Location | `~/.claude/skills/` | personal / project / custom |
| CLAUDE.md | `~/.claude/` | choose |

## Default stack (June 2026)

| Layer | Choice |
| --- | --- |
| Runtime | Node 20+ / TypeScript 5.7 |
| SDK | @solana/web3.js 1.98+ · @solana/spl-token 0.4+ |
| Tx support | legacy + v0 (ALTs flagged) |

## Contributing

1. Fork, branch `feat/<name>-DD-MM-2026`.
2. Add a rule in `analyzer/src/rules.ts` **with** a fixture in
   `analyzer/test/fixtures.ts`.
3. Keep findings honest: no rule should let the skill claim a transaction is
   "safe."

## License

MIT — see [LICENSE](LICENSE).
