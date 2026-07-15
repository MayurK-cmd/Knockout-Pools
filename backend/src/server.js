// Express app: starts the chain listener (which rebuilds the in-memory
// cache), wires the API routes, and serves a /health endpoint.

import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { start as startListener, getProvider } from "./listener.js";
import poolsRouter from "./routes/pools.js";
import * as cache from "./cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ARTIFACT_PATH = resolve(__dirname, "./contract/KnockoutPool.json");
const NAMES_PATH = resolve(__dirname, "../names.json");

// Persistent name registry (address → display name)
let names = {};
if (existsSync(NAMES_PATH)) {
  try {
    names = JSON.parse(readFileSync(NAMES_PATH, "utf-8"));
  } catch { /* ignore corrupt file */ }
}

function saveNames() {
  try {
    writeFileSync(NAMES_PATH, JSON.stringify(names, null, 2));
  } catch { /* best effort */ }
}

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

  const startBlockEnv = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : undefined;
  // Fire-and-forget the listener so the server starts immediately.
  // The listener replays history in the background, then polls for new events.
  startListenerWithRetry({
    rpcUrl,
    contractAddress,
    startBlock: Number.isFinite(startBlockEnv) ? startBlockEnv : undefined,
    onCacheReady: (n) => {
      console.log(`Cache rebuilt: ${n} pools loaded`);
    },
  }).catch((err) => {
    console.error(`listener: background replay failed (${err.message}), polling will catch up`);
  });

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", poolsRouter);

  // Name registry — POST to save, GET to retrieve
  app.post("/api/name", (req, res) => {
    const { address, name } = req.body;
    if (!address || !name || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "valid address and name required" });
    }
    names[address.toLowerCase()] = name.trim().slice(0, 24);
    saveNames();
    res.json({ ok: true });
  });

  app.get("/api/name/:address", (req, res) => {
    const addr = req.params.address.toLowerCase();
    res.json({ name: names[addr] || null });
  });

  app.post("/api/names", (req, res) => {
    // Bulk lookup: POST { addresses: ["0x...", "0x..."] }
    const { addresses } = req.body;
    if (!Array.isArray(addresses)) return res.status(400).json({ error: "addresses array required" });
    const result = {};
    for (const a of addresses) {
      const lower = a.toLowerCase();
      if (names[lower]) result[a] = names[lower];
    }
    res.json(result);
  });

  // Leaderboard — compute earnings from cached pools
  app.get("/api/leaderboard", (req, res) => {
    const earnings = {}; // address -> total MON earned (in wei)
    const refunds = {};  // address -> total MON refunded (in wei)
    const stats = {};    // address -> { wins, losses, totalPools }

    for (const p of cache.getAllPools()) {
      if (p.status === "finalized" && p.participants?.length) {
        const winnerCount = p.participants.filter((pt) => pt.pick === p.finalResult).length;
        if (winnerCount === 0) continue;
        const payout = BigInt(p.stakeAmount) * BigInt(p.participantCount) / BigInt(winnerCount);
        for (const pt of p.participants) {
          const addr = pt.address.toLowerCase();
          if (!stats[addr]) stats[addr] = { wins: 0, losses: 0, totalPools: 0 };
          stats[addr].totalPools++;
          if (pt.pick === p.finalResult) {
            stats[addr].wins++;
            if (pt.claimed) {
              earnings[addr] = (earnings[addr] || 0n) + payout;
            }
          } else {
            stats[addr].losses++;
          }
        }
      }
      if (p.status === "cancelled" && p.participants?.length) {
        for (const pt of p.participants) {
          const addr = pt.address.toLowerCase();
          if (!stats[addr]) stats[addr] = { wins: 0, losses: 0, totalPools: 0 };
          stats[addr].totalPools++;
          if (pt.claimed) {
            refunds[addr] = (refunds[addr] || 0n) + BigInt(p.stakeAmount);
          }
        }
      }
    }

    // Build leaderboard: sort by earnings (highest first)
    const leaderboard = Object.entries(earnings)
      .map(([address, earned]) => ({
        address,
        earned: earned.toString(),
        displayName: names[address] || null,
        ...(stats[address] || {}),
      }))
      .sort((a, b) => BigInt(b.earned) - BigInt(a.earned))
      .slice(0, 10);

    res.json(leaderboard);
  });

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
