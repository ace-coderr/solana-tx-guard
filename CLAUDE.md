# CLAUDE.md — solana-tx-guard

This project adds **pre-sign Solana transaction safety** to your coding agent.

## When to engage this skill

Whenever the task involves signing, approving, submitting, or reviewing a Solana
transaction, or building a signing gate for an agent. Load `skill/SKILL.md` and
route from there — do not load every sub-skill; pull only the file the task
needs.

## Hard rules (also in `rules/tx-guard-rules.md`)

- Never call a transaction "safe" — say "no static red flags" + caveats.
- Never recommend signing a `block` verdict or signing through a failed
  simulation.
- Zero token movement is not safety; ownership/authority changes move nothing at
  sign time.
- For agents, the signing gate lives in code, default-deny on `warn`, with a
  policy ceiling (caps/allowlists) on top.

## The analyzer

A runnable analyzer lives in `analyzer/`. Use it instead of reasoning about raw
bytes:

```bash
cd analyzer && npm install && npm run build
npx tx-guard <base64-tx> --json     # exit 1 == block
```

See `skill/using-the-analyzer.md`.

## Default stack (June 2026)

| Layer | Choice |
| --- | --- |
| Runtime | Node 20+ / TypeScript 5.7 |
| SDK | @solana/web3.js 1.98+, @solana/spl-token 0.4+ |
| Tx support | legacy + v0 (address lookup tables flagged) |
