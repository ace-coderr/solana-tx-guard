# Authority & drain attack classes

These are the instruction patterns that take over or empty an account while
moving zero (or trivial) tokens at sign time, so a wallet's balance-change
preview shows nothing alarming. Each maps to a finding `code` from the analyzer.

## OWNER_REASSIGNMENT — System `Assign` / `AssignWithSeed`

The single most dangerous instruction a normal user can be tricked into signing.
A System `Assign` changes the *owner program* of an account. Buried after an
innocuous-looking instruction, it hands your account to an attacker-controlled
program. The simulation shows: no SOL moved, no tokens moved, no approval
granted — yet the attacker now controls the account and can drain it whenever
they like; your private key becomes irrelevant.

- **Critical** when the reassigned account is the fee payer or a signer.
- **Benign exception:** an `Assign` immediately paired with a `CreateAccount`
  for the *same* account is normal initialization (the analyzer downgrades this
  to `ASSIGN_ON_NEW_ACCOUNT`).
- Triage: confirm the target account is one the user already owns. If yes and it
  was not just created in this tx → block.

## TOKEN_ACCOUNT_OWNER_TRANSFER — SPL `SetAuthority(AccountOwner)`

The SPL-token analogue of owner reassignment. `SetAuthority` with authority
type `AccountOwner` (2) transfers control of a token account to a new owner who
can then move every token in it — in a later, separate transaction. Invisible to
balance diffs. Always **critical**.

## TOKEN_AUTHORITY_CHANGE — `SetAuthority` (Mint / Freeze / Close)

Changing **MintTokens** authority enables later infinite mint (rug). Changing
**FreezeAccount** authority enables lockout. Changing **CloseAccount** authority
enables later rent/balance sweeps. **High**; legitimate during genuine token
administration, so confirm intent.

## DELEGATE_APPROVE — SPL `Approve` / `ApproveChecked`

Grants a delegate the right to move tokens out of an account, independent of
this transaction. The phishing pattern: "approve to use the dApp," then the
delegate drains later. **High**, and flagged as effectively unlimited when the
approved amount is enormous. Mitigation users should know: `Revoke`, and
periodic approval cleanup (Revoke.cash / wallet revoke tools).

## TOKEN_ACCOUNT_CLOSE — SPL `CloseAccount`

Closing a token account sends its remaining balance and rent to a destination.
**Medium** when the destination is the fee payer (intended cleanup), **high**
when it is a third party (sweep).

## PROGRAM_UPGRADE_AUTHORITY_CHANGE / PROGRAM_UPGRADE — BPF Loader Upgradeable

Whoever holds a program's upgrade authority can replace its logic. Reassigning
that authority, or upgrading a program, is the enabling move for TOCTOU
upgrade-swap drains (a transaction that simulated safe executes against new,
malicious code). **Critical** for authority change, **high** for upgrade.
Expected only in genuine governance/deploy flows.

## Combinations raise severity

A durable nonce alone is medium; a durable nonce **plus** an authority change is
high, because the dangerous instruction can be replayed against future state
(see `durable-nonce.md`). The scorer treats criticals as terminal: any single
critical finding forces a `block`.

## Triage checklist

1. Decode every instruction; do not trust the dApp's description.
2. For each authority/ownership instruction, ask: does the user actually intend
   to give away control of this account?
3. Treat "no balance change" as neutral, never as reassurance.
4. When unsure, downgrade the action to `warn` and require explicit human
   confirmation with the specific finding shown.
