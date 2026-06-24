# Resources

## Transaction & instruction references
- Solana transaction structure (legacy vs v0, address lookup tables): Solana docs
- System Program instruction set (Assign, AdvanceNonceAccount, …)
- SPL Token / Token-2022 instruction set (SetAuthority, Approve, CloseAccount)
- BPF Loader Upgradeable (Upgrade, SetAuthority)
- `@solana/web3.js` (`VersionedTransaction`, `simulateTransaction`)
- `@solana/spl-token` instruction builders

## Verifiable builds & program reputation
- Ellipsis Labs `solana-verify` — confirm on-chain bytecode matches source
- Program `ProgramData`: upgrade authority + last deployed slot

## Attack background (current to 2026)
- Owner-reassignment / hidden `assign` drainers (silent account takeover)
- TOCTOU / program-upgrade-swap drains (clean simulation, malicious execution)
- Durable-nonce pre-sign replay — the 2026 Drift drain (~$270M)
- "Agentic drainers" — malware targeting autonomous agent wallets
- "Sign all on failed simulation" / approval-crasher phishing

## Reputation feeds to consider wiring in
- Community drainer/scam address lists
- Sanctioned-address lists
- Verified-program registries

## Complementary skills (this skill does not duplicate them)
- `solana-dev-skill` — core development
- `solana-auditor` / Trail of Bits — program *source* security audits
- Squads — multisig treasury controls

> tx-guard defends the moment of signing. Program audits defend the code.
> They are complementary layers, not substitutes.
