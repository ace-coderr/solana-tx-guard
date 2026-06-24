import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { SimulationResult } from "./types.js";

/**
 * Run a transaction simulation against an RPC endpoint, if one is provided.
 * Simulation is a useful signal but is NEVER sufficient on its own: it reflects
 * on-chain state at simulation time and cannot anticipate program upgrades or
 * TOCTOU state changes between signing and execution. The rules engine is the
 * primary defense; simulation is corroboration.
 */
export async function simulate(
  base64Tx: string,
  rpcUrl?: string,
): Promise<SimulationResult> {
  if (!rpcUrl) {
    return {
      ran: false,
      err: null,
      logs: [],
      note: "No RPC endpoint supplied — static analysis only. Pass --rpc <url> to add simulation and resolve lookup tables.",
    };
  }
  try {
    const conn = new Connection(rpcUrl, "confirmed");
    const tx = VersionedTransaction.deserialize(
      Uint8Array.from(Buffer.from(base64Tx, "base64")),
    );
    const res = await conn.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });
    return {
      ran: true,
      err: res.value.err,
      logs: res.value.logs ?? [],
      note: "Simulation reflects current state only; it cannot detect post-sign program upgrades or TOCTOU drains.",
    };
  } catch (e) {
    return {
      ran: false,
      err: e instanceof Error ? e.message : String(e),
      logs: [],
      note: "Simulation failed to run; relying on static analysis.",
    };
  }
}
