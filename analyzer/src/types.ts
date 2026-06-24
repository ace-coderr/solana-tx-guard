// Core types for the tx-guard risk model.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Action = "block" | "warn" | "allow";

export interface Finding {
  /** Stable machine code, e.g. "OWNER_REASSIGNMENT". */
  code: string;
  severity: Severity;
  /** One-line human summary. */
  title: string;
  /** Why this is dangerous, in plain language. */
  detail: string;
  /** Index of the offending instruction in the message, when applicable. */
  ixIndex?: number;
  /** Program that owns the offending instruction. */
  program?: string;
  /** Accounts implicated (base58). */
  accounts?: string[];
}

export interface DecodedInstruction {
  ixIndex: number;
  programId: string;
  programName: string;
  /** Decoded operation name when known (e.g. "Assign", "SetAuthority"). */
  op?: string;
  accounts: string[];
  dataLenBytes: number;
  raw: Uint8Array;
}

export interface TxFacts {
  version: "legacy" | 0;
  feePayer: string;
  staticAccountKeys: string[];
  /** True if the message references Address Lookup Tables (accounts not statically present). */
  usesAddressLookupTables: boolean;
  numLookupAccounts: number;
  instructions: DecodedInstruction[];
  /** Recent blockhash / nonce hint. */
  recentBlockhash: string;
}

export interface Verdict {
  action: Action;
  /** 0 (safe) .. 100 (certain drain). */
  riskScore: number;
  findings: Finding[];
  facts: TxFacts;
  /** Optional simulation result when an RPC endpoint was supplied. */
  simulation?: SimulationResult;
  /** Always present: simulation is necessary but not sufficient. */
  caveats: string[];
}

export interface SimulationResult {
  ran: boolean;
  err: unknown | null;
  logs: string[];
  /** Net SOL change for the fee payer in lamports, if derivable. */
  feePayerLamportDelta?: number;
  note: string;
}
