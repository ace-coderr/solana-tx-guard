import { VersionedTransaction } from "@solana/web3.js";
import {
  PROGRAMS,
  SYSTEM_IX,
  TOKEN_IX,
  BPF_IX,
  programName,
  readU32LE,
} from "./programs.js";
import type { DecodedInstruction, TxFacts } from "./types.js";

const SYSTEM_IX_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(SYSTEM_IX).map(([k, v]) => [v, k]),
);
const TOKEN_IX_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(TOKEN_IX).map(([k, v]) => [v, k]),
);
const BPF_IX_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(BPF_IX).map(([k, v]) => [v, k]),
);

function decodeOp(programId: string, data: Uint8Array): string | undefined {
  if (data.length === 0) return undefined;
  if (programId === PROGRAMS.SYSTEM || programId === PROGRAMS.BPF_UPGRADEABLE) {
    const code = readU32LE(data, 0);
    const table = programId === PROGRAMS.SYSTEM ? SYSTEM_IX_NAME : BPF_IX_NAME;
    return table[code];
  }
  if (programId === PROGRAMS.TOKEN || programId === PROGRAMS.TOKEN_2022) {
    return TOKEN_IX_NAME[data[0]];
  }
  return undefined;
}

/** Parse a base64-encoded serialized transaction into normalized facts. */
export function decodeTransaction(base64Tx: string): TxFacts {
  const bytes = Uint8Array.from(Buffer.from(base64Tx, "base64"));
  const tx = VersionedTransaction.deserialize(bytes);
  const msg = tx.message;

  const staticKeys = msg.staticAccountKeys.map((k) => k.toBase58());
  const lookups = (msg as any).addressTableLookups ?? [];
  const numLookupAccounts = lookups.reduce(
    (n: number, l: any) =>
      n + (l.writableIndexes?.length ?? 0) + (l.readonlyIndexes?.length ?? 0),
    0,
  );

  const resolveKey = (idx: number): string =>
    idx < staticKeys.length ? staticKeys[idx] : `ALT#${idx}`;

  const instructions: DecodedInstruction[] = msg.compiledInstructions.map(
    (ix, ixIndex) => {
      const programId = staticKeys[ix.programIdIndex] ?? `ALT#${ix.programIdIndex}`;
      const data = ix.data instanceof Uint8Array ? ix.data : Uint8Array.from(ix.data);
      return {
        ixIndex,
        programId,
        programName: programName(programId),
        op: decodeOp(programId, data),
        accounts: ix.accountKeyIndexes.map(resolveKey),
        dataLenBytes: data.length,
        raw: data,
      };
    },
  );

  return {
    version: msg.version,
    feePayer: staticKeys[0],
    staticAccountKeys: staticKeys,
    usesAddressLookupTables: numLookupAccounts > 0,
    numLookupAccounts,
    instructions,
    recentBlockhash: msg.recentBlockhash,
  };
}
