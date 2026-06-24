# Program reputation & verification

A transaction is only as safe as the programs it invokes. Static decoding tells
you *which* programs are called; this file is how to judge whether they are
trustworthy.

## Known-good set

The analyzer ships a `VERIFIED_PROGRAMS` set of canonical native/SPL programs
(System, SPL Token, Token-2022, Associated Token Account, Compute Budget, Stake).
Instructions to these are decoded precisely. Anything outside the set raises
`UNVERIFIED_PROGRAM` (low on its own — most legitimate dApps are "unverified" by
this narrow definition), which is a prompt to check reputation, not an automatic
block.

## Signals that an unknown program is risky

- **Upgradeable + recently upgraded.** Query the program account (BPF Loader
  Upgradeable) for its upgrade authority and last deployment slot. A program
  upgraded minutes ago that you are about to interact with is the TOCTOU setup
  (see `simulation-limits.md`).
- **Live upgrade authority held by an EOA** (not a multisig/governance/immutable)
  means logic can change unilaterally at any time.
- **No verified build.** Solana verifiable builds (Ellipsis Labs `solana-verify`)
  let you confirm on-chain bytecode matches published source. Unverified +
  upgradeable + handling your funds is the high-risk combination.
- **Freshly deployed program with high requested authority** over your accounts.

## How to check (with an RPC)

1. Resolve the program's `ProgramData` account and read `upgrade_authority` and
   `last_deployed_slot`.
2. Compare `last_deployed_slot` against now — flag very recent upgrades.
3. Where the project publishes source, run `solana-verify get-program-hash`
   against the on-chain program and compare to the source build hash.
4. Cross-reference the program id against a maintained reputation feed.

## Address reputation feed

`KNOWN_MALICIOUS` is a seed set with a clean extension point. In production, load
a refreshable feed (community drainer lists, sanctioned-address lists, verified-
program registries) at startup and merge it in. Design rules:

- **Fail open on an empty/unreachable feed** (never hard-block every tx because a
  feed is down) — but log it.
- Treat a feed hit as `critical` (`KNOWN_MALICIOUS_ADDRESS`).
- Keep the feed source configurable; do not hardcode a single vendor.
