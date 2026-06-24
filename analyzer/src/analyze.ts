import { decodeTransaction } from "./decode.js";
import { evaluate, scoreAndDecide } from "./rules.js";
import { simulate } from "./simulate.js";
import type { Verdict } from "./types.js";

export * from "./types.js";

export interface AnalyzeOptions {
  /** Optional RPC URL to add simulation + lookup-table resolution. */
  rpcUrl?: string;
  /** Caller policy: max value, allowlist, etc. Applied on top of findings. */
  policy?: {
    /** Block if any of these account addresses are NOT in the allowlist. */
    recipientAllowlist?: string[];
  };
}

/**
 * Analyze a base64-encoded serialized Solana transaction before it is signed.
 * Returns a verdict suitable for both human review and autonomous agent gating.
 */
export async function analyzeTransaction(
  base64Tx: string,
  opts: AnalyzeOptions = {},
): Promise<Verdict> {
  const facts = decodeTransaction(base64Tx);
  const findings = evaluate(facts);

  // Optional policy: allowlist enforcement.
  if (opts.policy?.recipientAllowlist) {
    const allow = new Set(opts.policy.recipientAllowlist);
    const offenders = facts.staticAccountKeys.filter(
      (k, i) => i !== 0 && !allow.has(k),
    );
    if (offenders.length > 0) {
      findings.push({
        code: "POLICY_ALLOWLIST_VIOLATION",
        severity: "high",
        title: "Transaction references non-allowlisted accounts",
        detail: `Policy allows only specified recipients; saw ${offenders.length} other account(s).`,
        accounts: offenders.slice(0, 5),
      });
    }
  }

  const { riskScore, action } = scoreAndDecide(findings);
  const simulation = await simulate(base64Tx, opts.rpcUrl);

  const caveats = [
    "Static analysis cannot resolve accounts hidden in address lookup tables without an RPC endpoint.",
    "A clean verdict is not a guarantee: upgradeable programs and durable nonces can change behavior after you sign.",
  ];
  if (simulation.ran && simulation.err) {
    caveats.push("Simulation returned an error — do NOT 'sign anyway' on a failed simulation; that is a known drainer trick.");
  }

  return {
    action,
    riskScore,
    findings: findings.sort(
      (a, b) =>
        ["info", "low", "medium", "high", "critical"].indexOf(b.severity) -
        ["info", "low", "medium", "high", "critical"].indexOf(a.severity),
    ),
    facts,
    simulation,
    caveats,
  };
}
