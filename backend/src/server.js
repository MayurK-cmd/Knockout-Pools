// Express app: starts the chain listener (which rebuilds the in-memory
// cache), wires the API routes, and serves a /health endpoint.

import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { start as startListener, getProvider } from "./listener.js";
import poolsRouter from "./routes/pools.js";
import * as cache from "./cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ARTIFACT_PATH = resolve(__dirname, "./contract/KnockoutPool.json");

const PORT = Number(process.env.PORT || 3001);

function resolveContractAddress() {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  try {
    const raw = readFileSync(ARTIFACT_PATH, "utf-8");
    return JSON.parse(raw).address;
  } catch {
    return null;
  }
}

function failAndExit(msg) {
  console.error(`\n[FATAL] ${msg}\n`);
  console.error("Set MONAD_TESTNET_RPC_URL and CONTRACT_ADDRESS in your .env, or run");
  console.error("`npm run deploy` from the contracts/ folder to populate");
  console.error("backend/src/contract/KnockoutPool.json.\n");
  process.exit(1);
}

async function startListenerWithRetry(opts) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await startListener(opts);
      return;
    } catch (err) {
      attempt += 1;
      const wait = Math.min(2000 * attempt, 30000);
      console.error(`[startup] listener failed (${err?.shortMessage ?? err?.message ?? err}); retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  const rpcUrl = process.env.MONAD_TESTNET_RPC_URL;
  const contractAddress = resolveContractAddress();

  if (!rpcUrl) failAndExit("MONAD_TESTNET_RPC_URL is not set.");
  if (!contractAddress) failAndExit("CONTRACT_ADDRESS is not set and src/contract/KnockoutPool.json has no address.");

  // Start the listener (replays history, then attaches live subscription).
  // We surface its errors so the server doesn't claim to be healthy with
  // an empty cache.
  const startBlockEnv = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : undefined;
  await startListenerWithRetry({
    rpcUrl,
    contractAddress,
    startBlock: Number.isFinite(startBlockEnv) ? startBlockEnv : undefined,
    onCacheReady: (n) => {
      console.log(`Cache rebuilt: ${n} pools loaded`);
    },
  });

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", poolsRouter);

  app.get("/health", async (_req, res) => {
    let blockNumber = null;
    try {
      blockNumber = await getProvider().getBlockNumber();
    } catch {
      /* provider may be temporarily down; report null */
    }
    res.json({
      ok: true,
      poolCount: cache.getPoolCount(),
      blockNumber,
    });
  });

  // Root: small index so curl on / isn't an error.
  app.get("/", (_req, res) => {
    res.json({
      name: "knockout-pools-backend",
      routes: ["/health", "/api/pools", "/api/pools/:id", "/api/pools/:id/participants"],
    });
  });

  // 404 + error handler
  app.use((req, res) => res.status(404).json({ error: "not found" }));
  app.use((err, _req, res, _next) => {
    console.error("unhandled error:", err);
    res.status(500).json({ error: "internal error" });
  });

  app.listen(PORT, () => {
    console.log(`Knockout Pools backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[FATAL] server failed to start:", err);
  process.exit(1);
});
