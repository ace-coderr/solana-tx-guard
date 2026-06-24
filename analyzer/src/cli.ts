#!/usr/bin/env node
import { analyzeTransaction } from "./analyze.js";
import type { Verdict, Severity } from "./types.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

const COLOR: Record<Severity, string> = {
  critical: "\x1b[41m\x1b[97m",
  high: "\x1b[31m",
  medium: "\x1b[33m",
  low: "\x1b[90m",
  info: "\x1b[90m",
};
const RESET = "\x1b[0m";
const ACTION_BANNER = {
  block: "\x1b[41m\x1b[97m BLOCK \x1b[0m",
  warn: "\x1b[43m\x1b[30m WARN \x1b[0m",
  allow: "\x1b[42m\x1b[30m ALLOW \x1b[0m",
};

function printHuman(v: Verdict) {
  console.log("");
  console.log(`${ACTION_BANNER[v.action]}  risk score ${v.riskScore}/100`);
  console.log(`fee payer: ${v.facts.feePayer}`);
  console.log(`version: ${v.facts.version}  instructions: ${v.facts.instructions.length}`);
  console.log("");
  if (v.findings.length === 0) {
    console.log("No risk findings from static analysis.");
  } else {
    for (const f of v.findings) {
      const c = COLOR[f.severity];
      console.log(`${c}[${f.severity.toUpperCase()}]${RESET} ${f.title}  (${f.code})`);
      console.log(`   ${f.detail}`);
      if (f.ixIndex !== undefined) console.log(`   instruction #${f.ixIndex} · ${f.program ?? ""}`);
      if (f.accounts?.length) console.log(`   accounts: ${f.accounts.join(", ")}`);
      console.log("");
    }
  }
  if (v.simulation) console.log(`simulation: ${v.simulation.ran ? (v.simulation.err ? "ERROR" : "ok") : "skipped"} — ${v.simulation.note}`);
  console.log("");
  for (const cav of v.caveats) console.log(`! ${cav}`);
  console.log("");
}

async function main() {
  const tx = arg("--tx") ?? process.argv[2];
  if (!tx || tx.startsWith("--")) {
    console.error(
      "usage: tx-guard <base64-tx> [--rpc <url>] [--json] [--allow <addr,addr>]\n" +
        "       tx-guard --tx <base64-tx> --json",
    );
    process.exit(2);
  }
  const allow = arg("--allow")?.split(",").map((s) => s.trim()).filter(Boolean);
  const verdict = await analyzeTransaction(tx, {
    rpcUrl: arg("--rpc"),
    policy: allow ? { recipientAllowlist: allow } : undefined,
  });

  if (has("--json")) {
    // Drop the raw byte arrays for clean agent-parseable output.
    const clean = {
      ...verdict,
      facts: {
        ...verdict.facts,
        instructions: verdict.facts.instructions.map(({ raw, ...rest }) => rest),
      },
    };
    console.log(JSON.stringify(clean, null, 2));
  } else {
    printHuman(verdict);
  }

  // Exit code doubles as a gate for shell/agent pipelines.
  process.exit(verdict.action === "block" ? 1 : 0);
}

main().catch((e) => {
  console.error("tx-guard error:", e instanceof Error ? e.message : e);
  process.exit(2);
});
