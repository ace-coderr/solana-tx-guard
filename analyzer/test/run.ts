import { analyzeTransaction } from "../src/analyze.js";
import { FIXTURES } from "./fixtures.js";

let passed = 0;
let failed = 0;

for (const [name, fx] of Object.entries(FIXTURES)) {
  const v = await analyzeTransaction(fx.b64);
  const codes = v.findings.map((f) => f.code);
  const actionOk = v.action === fx.expect;
  const codeOk = !fx.mustHave || codes.includes(fx.mustHave);
  const ok = actionOk && codeOk;
  if (ok) passed++;
  else failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}  -> ${v.action} (score ${v.riskScore})` +
      (fx.mustHave ? `  [${fx.mustHave}: ${codeOk ? "found" : "MISSING"}]` : ""),
  );
  if (!actionOk) console.log(`     expected action ${fx.expect}, got ${v.action}`);
  if (!ok) console.log(`     findings: ${codes.join(", ") || "(none)"}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
