import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
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
const fakeBlockhash = Keypair.generate().publicKey.toBase58();

function v0(instructions: any[]): string {
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: fakeBlockhash,
    instructions,
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  return Buffer.from(tx.serialize()).toString("base64");
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
      // looks like a normal interaction...
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 1000 }),
      // ...but silently hands the payer's account to an attacker program.
      SystemProgram.assign({ accountPubkey: payer, programId: attackerProgram }),
    ]),
    expect: "block",
    mustHave: "OWNER_REASSIGNMENT",
  },
  token_owner_transfer: {
    b64: legacy([
      createSetAuthorityInstruction(
        tokenAccount,
        payer,
        AuthorityType.AccountOwner,
        newOwner,
        [],
        TOKEN_PROGRAM_ID,
      ),
    ]),
    expect: "block",
    mustHave: "TOKEN_ACCOUNT_OWNER_TRANSFER",
  },
  unlimited_delegate: {
    b64: v0([
      createApproveInstruction(
        tokenAccount,
        delegate,
        payer,
        18446744073709551615n,
        [],
        TOKEN_PROGRAM_ID,
      ),
    ]),
    expect: "warn",
    mustHave: "DELEGATE_APPROVE",
  },
};
