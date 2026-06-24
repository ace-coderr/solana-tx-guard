# Address checks: poisoning, lookalikes & lookup tables

## Address poisoning / lookalike recipients

Attackers seed a victim's history with transactions from an address that shares
the victim's intended recipient's first/last characters (vanity-generated). The
victim later copies the wrong address from history. Defenses the skill applies:

- Compare each recipient against the signer's recent counterparties; flag a
  near-match (same prefix/suffix, different middle) as a likely lookalike.
- Never judge an address by truncated display (`Ax3…9kP`). Match full base58.
- When a recipient is a brand-new address receiving the bulk of value, surface it
  for explicit confirmation.

(The bundled analyzer flags known-bad addresses via the reputation feed and
exposes recipients in `facts` so a wallet can run its own lookalike comparison
against local history.)

## Address lookup tables (ALTs) hide the account set

v0 transactions can reference accounts indirectly through address lookup tables.
Those accounts are **not present in the serialized transaction** — only indexes
are. Static analysis alone cannot see who they are, which means a recipient or
program could be concealed in an ALT.

- The analyzer raises `ALT_OBSCURED_ACCOUNTS` (medium) and reports how many
  accounts resolve through tables.
- With `--rpc`, resolve the lookup tables and re-run so the hidden accounts are
  evaluated like any other.
- Be especially wary when an otherwise simple transaction pulls many accounts
  from ALTs — complexity is a place to hide intent.

## Practical rule

If you cannot fully enumerate every account a transaction touches (because of
ALTs and no RPC), do not return `allow` with confidence — return `warn` and say
which accounts could not be resolved.
