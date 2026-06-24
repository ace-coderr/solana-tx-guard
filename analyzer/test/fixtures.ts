import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  createSetAuthorityInstruction,
  createApproveInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const payer = Keypair.generate().publicKey;
const recipient = Keypair.generate().publicKey;
const attackerProgram = Keypair.generate().publicKey;
const tokenAccount = Keypair.generate().publicKey;
const newOwner = Keypair.generate().publicKey;
const delegate = Keypair.generate().publicKey;
const nonceAccount = Keypair.generate().publicKey;
const fakeBlockhash = Keypair.generate().publicKey.toBase58();

const BPF_UPGRADEABLE = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function v0(instructions: any[], luts: AddressLookupTableAccount[] = []): string {
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: fakeBlockhash,
    instructions,
  }).compileToV0Message(luts);
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

function legacy(instructions: any[]): string {
  const tx = new Transaction();
  tx.feePayer = payer;
  tx.recentBlockhash = fakeBlockhash;
  for (const ix of instructions) tx.add(ix);
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

// --- helpers for the new fixtures ---

const setAuthorityOwner = () =>
  createSetAuthorityInstruction(
    tokenAccount,
    payer,
    AuthorityType.AccountOwner,
    newOwner,
    [],
    TOKEN_PROGRAM_ID,
  );

const advanceNonce = () =>
  SystemProgram.nonceAdvance({ noncePubkey: nonceAccount, authorizedPubkey: payer });

const programSetAuthority = () =>
  new TransactionInstruction({
    programId: BPF_UPGRADEABLE,
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: false },
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(Uint8Array.of(4, 0, 0, 0)), // SetAuthority
  });

// account that will be hidden inside an address lookup table
const hiddenAccount = Keypair.generate().publicKey;
const lut = new AddressLookupTableAccount({
  key: Keypair.generate().publicKey,
  state: {
    deactivationSlot: 2n ** 64n - 1n,
    lastExtendedSlot: 0,
    lastExtendedSlotStartIndex: 0,
    authority: payer,
    addresses: [hiddenAccount],
  },
});
const memoReferencingHidden = () =>
  new TransactionInstruction({
    programId: MEMO,
    keys: [{ pubkey: hiddenAccount, isSigner: false, isWritable: false }],
    data: Buffer.from("hi"),
  });

export const FIXTURES: Record<
  string,
  { b64: string; expect: "block" | "warn" | "allow"; mustHave?: string }
> = {
  benign_transfer: {
    b64: v0([
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 1_000_000 }),
    ]),
    expect: "allow",
  },
  owner_reassignment_drainer: {
    b64: v0([
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 1000 }),
      SystemProgram.assign({ accountPubkey: payer, programId: attackerProgram }),
    ]),
    expect: "block",
    mustHave: "OWNER_REASSIGNMENT",
  },
  token_owner_transfer: {
    b64: legacy([setAuthorityOwner()]),
    expect: "block",
    mustHave: "TOKEN_ACCOUNT_OWNER_TRANSFER",
  },
  unlimited_delegate: {
    b64: v0([
      createApproveInstruction(tokenAccount, delegate, payer, 18446744073709551615n, [], TOKEN_PROGRAM_ID),
    ]),
    expect: "warn",
    mustHave: "DELEGATE_APPROVE",
  },
  durable_nonce_only: {
    b64: v0([
      advanceNonce(),
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 1000 }),
    ]),
    expect: "warn",
    mustHave: "DURABLE_NONCE",
  },
  durable_nonce_combo: {
    // pre-signed, replayable, AND changes ownership -> the acute pattern
    b64: legacy([advanceNonce(), setAuthorityOwner()]),
    expect: "block",
    mustHave: "DURABLE_NONCE",
  },
  program_upgrade_authority_change: {
    b64: v0([programSetAuthority()]),
    expect: "block",
    mustHave: "PROGRAM_UPGRADE_AUTHORITY_CHANGE",
  },
  alt_obscured_accounts: {
    b64: v0([memoReferencingHidden()], [lut]),
    expect: "warn",
    mustHave: "ALT_OBSCURED_ACCOUNTS",
  },
};