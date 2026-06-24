import {
  PROGRAMS,
  SYSTEM_IX,
  TOKEN_IX,
  BPF_IX,
  TOKEN_AUTHORITY_TYPE,
  VERIFIED_PROGRAMS,
  KNOWN_MALICIOUS,
  readU32LE,
} from "./programs.js";
import type { Finding, TxFacts, DecodedInstruction } from "./types.js";

const SEVERITY_POINTS = {
  critical: 100,
  high: 60,
  medium: 30,
  low: 10,
  info: 0,
} as const;

function readU64LE(data: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8 && offset + i < data.length; i++) {
    v |= BigInt(data[offset + i]) << BigInt(8 * i);
  }
  return v;
}

/** Accounts created within this same transaction (Assign on these is benign init). */
function accountsCreatedInTx(facts: TxFacts): Set<string> {
  const created = new Set<string>();
  for (const ix of facts.instructions) {
    if (ix.programId !== PROGRAMS.SYSTEM) continue;
    const code = readU32LE(ix.raw, 0);
    if (code === SYSTEM_IX.CreateAccount || code === SYSTEM_IX.CreateAccountWithSeed) {
      // For CreateAccount the new account is accounts[1]; for *WithSeed it is accounts[1] too.
      if (ix.accounts[1]) created.add(ix.accounts[1]);
    }
  }
  return created;
}

export function evaluate(facts: TxFacts): Finding[] {
  const findings: Finding[] = [];
  const created = accountsCreatedInTx(facts);
  const feePayer = facts.feePayer;
  let durableNonce = false;

  for (const ix of facts.instructions) {
    // --- Known-malicious address touch (any program) ---
    for (const acc of [ix.programId, ...ix.accounts]) {
      if (KNOWN_MALICIOUS.has(acc)) {
        findings.push({
          code: "KNOWN_MALICIOUS_ADDRESS",
          severity: "critical",
          title: "Transaction touches a flagged address",
          detail: `Address ${acc} appears on the loaded malicious-address feed.`,
          ixIndex: ix.ixIndex,
          program: ix.programName,
          accounts: [acc],
        });
      }
    }

    // --- System Program ---
    if (ix.programId === PROGRAMS.SYSTEM) {
      const code = readU32LE(ix.raw, 0);

      if (code === SYSTEM_IX.Assign || code === SYSTEM_IX.AssignWithSeed) {
        const target = ix.accounts[0];
        const isInit = created.has(target);
        if (isInit) {
          findings.push({
            code: "ASSIGN_ON_NEW_ACCOUNT",
            severity: "info",
            title: "Owner assignment on a freshly created account",
            detail: "Assign follows a CreateAccount for the same account; normal initialization.",
            ixIndex: ix.ixIndex,
            program: ix.programName,
            accounts: [target],
          });
        } else {
          const critical = target === feePayer || facts.staticAccountKeys[0] === target;
          findings.push({
            code: "OWNER_REASSIGNMENT",
            severity: critical ? "critical" : "high",
            title: "Account ownership is being reassigned",
            detail:
              "A System Assign hands control of an existing account to another program. " +
              "This moves zero tokens at sign time, so balance simulation shows nothing — " +
              "but the new owner can drain the account afterward. Classic silent-takeover drainer.",
            ixIndex: ix.ixIndex,
            program: ix.programName,
            accounts: [target],
          });
        }
      }

      if (code === SYSTEM_IX.AdvanceNonceAccount) durableNonce = true;
    }

    // --- SPL Token / Token-2022 ---
    if (ix.programId === PROGRAMS.TOKEN || ix.programId === PROGRAMS.TOKEN_2022) {
      const code = ix.raw[0];

      if (code === TOKEN_IX.SetAuthority) {
        const authType = ix.raw[1];
        const label = TOKEN_AUTHORITY_TYPE[authType] ?? `type ${authType}`;
        const isOwner = authType === 2; // AccountOwner
        findings.push({
          code: isOwner ? "TOKEN_ACCOUNT_OWNER_TRANSFER" : "TOKEN_AUTHORITY_CHANGE",
          severity: isOwner ? "critical" : "high",
          title: isOwner
            ? "Token account ownership transfer"
            : `Token ${label} authority change`,
          detail: isOwner
            ? "SetAuthority(AccountOwner) hands your token account to a new owner who can then move every token in it. No transfer appears in simulation."
            : `SetAuthority changes the ${label} authority. Mint/Freeze/Close authority changes can enable later rug or lockout.`,
          ixIndex: ix.ixIndex,
          program: ix.programName,
          accounts: ix.accounts.slice(0, 2),
        });
      }

      if (code === TOKEN_IX.Approve || code === TOKEN_IX.ApproveChecked) {
        const amount = readU64LE(ix.raw, 1);
        const huge = amount > 10n ** 18n;
        findings.push({
          code: "DELEGATE_APPROVE",
          severity: "high",
          title: "Spend authority delegated to another account",
          detail:
            `Approve grants a delegate the right to move tokens` +
            (huge ? " (amount is effectively unlimited)" : ` (amount ${amount})`) +
            ". A malicious delegate can drain later, outside this transaction.",
          ixIndex: ix.ixIndex,
          program: ix.programName,
          accounts: ix.accounts.slice(0, 2),
        });
      }

      if (code === TOKEN_IX.CloseAccount) {
        const destination = ix.accounts[1];
        const toSelf = destination === feePayer;
        findings.push({
          code: "TOKEN_ACCOUNT_CLOSE",
          severity: toSelf ? "medium" : "high",
          title: "Token account is being closed",
          detail: toSelf
            ? "CloseAccount returns rent to the fee payer; benign if you intended to close this account."
            : "CloseAccount sweeps the remaining balance and rent to a third-party destination.",
          ixIndex: ix.ixIndex,
          program: ix.programName,
          accounts: ix.accounts.slice(0, 2),
        });
      }
    }

    // --- BPF Loader Upgradeable: program-level control ---
    if (ix.programId === PROGRAMS.BPF_UPGRADEABLE) {
      const code = readU32LE(ix.raw, 0);
      if (code === BPF_IX.SetAuthority || code === BPF_IX.SetAuthorityChecked) {
        findings.push({
          code: "PROGRAM_UPGRADE_AUTHORITY_CHANGE",
          severity: "critical",
          title: "Program upgrade authority is being changed",
          detail:
            "Whoever holds upgrade authority can replace program logic at will — the TOCTOU upgrade-swap vector. Confirm this is an intended governance action.",
          ixIndex: ix.ixIndex,
          program: ix.programName,
        });
      }
      if (code === BPF_IX.Upgrade) {
        findings.push({
          code: "PROGRAM_UPGRADE",
          severity: "high",
          title: "A program is being upgraded",
          detail: "Program bytecode is being replaced. A transaction that was safe to sign earlier can execute against new logic.",
          ixIndex: ix.ixIndex,
          program: ix.programName,
        });
      }
    }

    // --- Unverified program (review reputation) ---
    if (
      !VERIFIED_PROGRAMS.has(ix.programId) &&
      ix.programId !== PROGRAMS.BPF_UPGRADEABLE &&
      !ix.programId.startsWith("ALT#")
    ) {
      findings.push({
        code: "UNVERIFIED_PROGRAM",
        severity: "low",
        title: "Instruction calls an unverified program",
        detail: `Program ${ix.programId} is not in the known-good set. Check it is upgradeable/verified and reputable before signing — upgradeable programs can change behavior after signing.`,
        ixIndex: ix.ixIndex,
        program: ix.programName,
      });
    }
  }

  // --- Durable nonce (tx-wide) ---
  if (durableNonce) {
    const escalate = findings.some(
      (f) => f.severity === "critical" || f.severity === "high",
    );
    findings.push({
      code: "DURABLE_NONCE",
      severity: escalate ? "high" : "medium",
      title: "Transaction uses a durable nonce",
      detail:
        "Durable-nonce transactions do not expire with the blockhash; a signed copy can be broadcast much later. This is the pattern abused in the 2026 Drift drain. Be certain you are not pre-signing something that can be replayed against future state." +
        (escalate ? " Combined with an authority/ownership change here, the replay risk is acute." : ""),
    });
  }

  // --- Address lookup tables obscure the account set ---
  if (facts.usesAddressLookupTables) {
    findings.push({
      code: "ALT_OBSCURED_ACCOUNTS",
      severity: "medium",
      title: "Some accounts are hidden behind address lookup tables",
      detail: `${facts.numLookupAccounts} account(s) resolve through lookup tables and cannot be fully evaluated without on-chain resolution. Run with an RPC endpoint to resolve and re-check, and be wary if the recipient set is not what you expect.`,
    });
  }

  return findings;
}

export function scoreAndDecide(findings: Finding[]): {
  riskScore: number;
  action: "block" | "warn" | "allow";
} {
  let score = 0;
  let hasCritical = false;
  for (const f of findings) {
    score += SEVERITY_POINTS[f.severity];
    if (f.severity === "critical") hasCritical = true;
  }
  const riskScore = Math.min(100, hasCritical ? Math.max(90, score) : score);
  const action = riskScore >= 70 ? "block" : riskScore >= 25 ? "warn" : "allow";
  return { riskScore, action };
}
