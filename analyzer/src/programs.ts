// Known programs and the specific instruction discriminators that matter for
// pre-sign risk. We intentionally decode by program id + leading data bytes
// rather than full IDL parsing: it is dependency-light, fast, and covers the
// account-takeover / drain classes that balance-diff simulation cannot see.

export const PROGRAMS = {
  SYSTEM: "11111111111111111111111111111111",
  TOKEN: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  TOKEN_2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ATA: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  BPF_UPGRADEABLE: "BPFLoaderUpgradeab1e11111111111111111111111",
  COMPUTE_BUDGET: "ComputeBudget111111111111111111111111111111",
  STAKE: "Stake11111111111111111111111111111111111111",
} as const;

export const PROGRAM_NAMES: Record<string, string> = {
  [PROGRAMS.SYSTEM]: "System Program",
  [PROGRAMS.TOKEN]: "SPL Token",
  [PROGRAMS.TOKEN_2022]: "Token-2022",
  [PROGRAMS.ATA]: "Associated Token Account",
  [PROGRAMS.BPF_UPGRADEABLE]: "BPF Loader (Upgradeable)",
  [PROGRAMS.COMPUTE_BUDGET]: "Compute Budget",
  [PROGRAMS.STAKE]: "Stake Program",
};

// System Program instruction indices (u32 little-endian at data[0..4]).
export const SYSTEM_IX = {
  CreateAccount: 0,
  Assign: 1, // <-- owner reassignment: silent account takeover
  Transfer: 2,
  CreateAccountWithSeed: 3,
  AdvanceNonceAccount: 4, // <-- durable nonce in use (pre-sign / long-lived risk)
  WithdrawNonceAccount: 5,
  InitializeNonceAccount: 6,
  AuthorizeNonceAccount: 7,
  Allocate: 8,
  AllocateWithSeed: 9,
  AssignWithSeed: 10, // <-- owner reassignment variant
  TransferWithSeed: 11,
  UpgradeNonceAccount: 12,
} as const;

// SPL Token / Token-2022 instruction indices (u8 at data[0]).
export const TOKEN_IX = {
  Approve: 4, // delegate spend authority
  Revoke: 5,
  SetAuthority: 6, // change mint/freeze/owner/close authority
  Burn: 8,
  CloseAccount: 9, // sweep rent + close
  ApproveChecked: 13,
  BurnChecked: 15,
} as const;

// Token authority types for SetAuthority (data byte after the discriminator).
export const TOKEN_AUTHORITY_TYPE: Record<number, string> = {
  0: "MintTokens",
  1: "FreezeAccount",
  2: "AccountOwner", // <-- transfers ownership of the token account
  3: "CloseAccount",
};

// BPF Loader Upgradeable instruction indices (u32 le).
export const BPF_IX = {
  Upgrade: 3,
  SetAuthority: 4, // change program upgrade authority
  Close: 5,
  SetAuthorityChecked: 7,
} as const;

/**
 * Address reputation. In production this is backed by a refreshable feed
 * (community drainer lists, sanctioned addresses, verified-program registry).
 * Shipped with a small seed set and a clean extension point; the skill docs
 * explain how to wire a live feed. Never hard-fail closed on an empty feed.
 */
export const KNOWN_MALICIOUS = new Set<string>([
  // seed entries only; real deployments load a maintained feed.
]);

export const VERIFIED_PROGRAMS = new Set<string>([
  PROGRAMS.SYSTEM,
  PROGRAMS.TOKEN,
  PROGRAMS.TOKEN_2022,
  PROGRAMS.ATA,
  PROGRAMS.COMPUTE_BUDGET,
  PROGRAMS.STAKE,
]);

export function programName(id: string): string {
  return PROGRAM_NAMES[id] ?? "Unknown / unverified program";
}

export function readU32LE(data: Uint8Array, offset = 0): number {
  if (data.length < offset + 4) return -1;
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}
