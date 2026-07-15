// Event listener: rebuilds the in-memory cache from chain history, then
// subscribes to live events. Reconnects every 5 seconds if the RPC dies.

import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as cache from "./cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ABI lives next to this file under src/contract/. Fall back to that file
// if CONTRACT_ADDRESS is missing from the env (deploy script wrote address there).
const ARTIFACT_PATH = resolve(__dirname, "./contract/KnockoutPool.json");

function loadArtifact() {
  const raw = readFileSync(ARTIFACT_PATH, "utf-8");
  return JSON.parse(raw);
}

let provider;
let contract;
let artifact;

let liveHandlers = [];

export function getProvider() {
  return provider;
}

export function getContract() {
  return contract;
}

export function getArtifact() {
  return artifact;
}

/// Replays the chain history into the cache, then attaches live listeners.
/// Throws on fatal errors (no contract address, etc.) so the caller can
/// surface them and exit.
export async function start({ rpcUrl, contractAddress, startBlock, onCacheReady } = {}) {
  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS is required (set in .env or src/contract/KnockoutPool.json)");
  }
  if (!rpcUrl) {
    throw new Error("MONAD_TESTNET_RPC_URL is required");
  }

  artifact = loadArtifact();
  const address = contractAddress || artifact.address;
  if (!address) {
    throw new Error("CONTRACT_ADDRESS is required (set in .env or src/contract/KnockoutPool.json)");
  }

  provider = new ethers.JsonRpcProvider(rpcUrl);
  contract = new ethers.Contract(address, artifact.abi, provider);

  // ---- 1. Fast-path: read pools directly from the contract via view functions. ----
  // This is much faster than scanning event logs on a rate-limited RPC.
  await fastSyncFromContract().catch((err) => {
    console.warn(`listener: fast-sync failed (${err.message}), falling back to replay`);
    if (typeof startBlock === "number" && startBlock >= 0) {
      return replayHistory(startBlock).catch(() => {});
    }
  });

  // ---- Subscribe to live events (first tick catches up history). ----
  attachLiveHandlers();

  if (typeof onCacheReady === "function") onCacheReady(cache.getPoolCount());
}

async function replayHistory(fromBlock) {
  const handlers = {
    PoolCreated: onPoolCreated,
    BetPlaced: onBetPlaced,
    PoolLocked: onPoolLocked,
    ResultProposed: onResultProposed,
    ResultDisputed: onResultDisputed,
    PoolFinalized: onPoolFinalized,
    PoolCancelled: onPoolCancelled,
    PayoutClaimed: onPayoutClaimed,
    RefundClaimed: onRefundClaimed,
  };

  // Build a single OR'd topic-0 filter covering every event we care about.
  // This is what makes one getLogs call return all event types for the
  // chunk, instead of 9 sequential calls. Crucial for staying under
  // Alchemy's free-tier rate limit on startup.
  const iface = contract.interface;
  const eventTopics = Object.keys(handlers).map((name) => iface.getEvent(name).topicHash);
  const filter = { address: await contract.getAddress(), topics: [eventTopics] };

  const latest = await provider.getBlockNumber();
  const latestBig = BigInt(latest);
  let start = BigInt(fromBlock);
  let backoffMs = 0;

  while (start <= latestBig) {
    const chunk = workingChunk();
    const end = start + BigInt(chunk) - 1n > latestBig ? latestBig : start + BigInt(chunk) - 1n;

    if (backoffMs > 0) {
      await sleep(backoffMs);
      backoffMs = 0;
    }

    let logs;
    try {
      logs = await provider.getLogs({ ...filter, fromBlock: start, toBlock: end });
    } catch (err) {
      const code = err?.info?.error?.code ?? err?.code;
      const msg = (
        err?.info?.error?.message ??
        err?.info?.responseBody ??
        err?.shortMessage ??
        err?.message ??
        ""
      ).toLowerCase();

      // 429 / rate limit: back off and retry the same range. This includes
      // the "could not coalesce error" wrapper ethers uses when the error
      // body can't be JSON-decoded, which is common on Alchemy's free tier
      // when it's actually throttling us.
      if (
        code === 429 ||
        msg.includes("compute units") ||
        msg.includes("rate limit") ||
        msg.includes("throughput") ||
        msg.includes("could not coalesce")
      ) {
        backoffMs = Math.min((backoffMs || 250) * 2, 8000);
        console.warn(`listener: 429 from RPC, backing off ${backoffMs}ms`);
        // If the backoff gets long, just give up on the historical replay
        // and trust the polling loop to keep the cache warm. The contract
        // is brand new and likely has no history to replay anyway.
        if (backoffMs >= 4000) {
          console.warn("listener: giving up on historical replay, polling will catch up");
          return;
        }
        continue;
      }

      const smaller = shrinkChunk(err);
      if (smaller) {
        workingChunkSize = smaller;
        console.warn(`listener: shrinking chunk to ${workingChunkSize} blocks (${msg.slice(0, 80)})`);
        continue;
      }
      console.error(`listener: chunk ${start}-${end} failed:`, err.message);
      start = end + 1n;
      continue;
    }

    // Decode each log and dispatch to the right handler.
    for (const log of logs) {
      let parsed;
      try {
        parsed = iface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;
      const handler = handlers[parsed.name];
      if (!handler) continue;
      // Build a thin evt-like object the handlers already understand.
      const fakeEvt = { args: parsed.args, log };
      try {
        await handler(fakeEvt);
      } catch (err) {
        console.error(`listener: error processing historical ${parsed.name}:`, err.message);
      }
    }

    start = end + 1n;
    // Tiny yield so we don't pin the event loop and so back-to-back chunks
    // space their RPC calls naturally.
    await sleep(5);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// Retry a single RPC call with exponential backoff if it fails with a
/// rate-limit-style error. Used for the rare blocking calls (getBlockNumber,
/// getCode, getPool) that don't have the 429-aware loop in replayHistory.
async function withRpcBackoff(fn, { maxAttempts = 6, baseMs = 250 } = {}) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err?.info?.error?.code ?? err?.code;
      const msg = (err?.info?.error?.message ?? err?.info?.responseBody ?? err?.shortMessage ?? err?.message ?? "").toLowerCase();
      const isRateLimit =
        code === 429 ||
        msg.includes("compute units") ||
        msg.includes("rate limit") ||
        msg.includes("throughput") ||
        msg.includes("could not coalesce");
      if (!isRateLimit) throw err;
      const wait = Math.min(baseMs * 2 ** i, 8000);
      console.warn(`listener: 429 on RPC; backing off ${wait}ms (attempt ${i + 1}/${maxAttempts})`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// Chunk size for getLogs calls. Monad's public RPC supports much larger
// ranges than Alchemy free tier. Start at 500 blocks per request.
let workingChunkSize = 50;

function workingChunk() {
  return workingChunkSize;
}

/// Parse the "block range" hint from common RPC error messages and return a
/// smaller chunk size to retry with, or null if we couldn't extract a hint.
function shrinkChunk(err) {
  if (!workingChunkSize || workingChunkSize <= 1) return null;
  const msg = (err?.info?.error?.message ?? err?.shortMessage ?? err?.message ?? "").toLowerCase();
  // Common patterns: "10 block range", "max block range: 100", etc.
  const m1 = msg.match(/(\d+)\s*block\s*range/);
  const m2 = msg.match(/max.*?(\d+).*block/);
  let cap = null;
  if (m1) cap = Number(m1[1]);
  else if (m2) cap = Number(m2[1]);
  if (cap && cap > 0 && cap < workingChunkSize) {
    return Math.max(1, cap);
  }
  // No explicit hint — halve and retry once.
  return Math.max(1, Math.floor(workingChunkSize / 2));
}

let pollTimer = null;
let lastPolledBlock = null;

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 8000);
const POLL_WINDOW = 200; // how many recent blocks to scan each tick

function attachLiveHandlers() {
  detachLiveHandlers();
  startPolling();
}

/// Polling-based "live" update. Alchemy's free tier doesn't support
/// eth_newFilter / eth_subscribe for event subscriptions, so we poll
/// the last N blocks every POLL_INTERVAL_MS. The frontend tolerates a
/// short delay before the cache reflects new state — all writes go
/// directly from the frontend to the chain, this cache is read-only.
function startPolling() {
  if (pollTimer) return;
  let caughtUp = false;
  const tick = async () => {
    try {
      const head = await withRpcBackoff(() => provider.getBlockNumber());
      if (lastPolledBlock == null) {
        lastPolledBlock = head;
        // First tick: replay history from a wide window using the chunked
        // replay mechanism that handles rate limits gracefully.
        const fromBlock = Math.max(0, head - 10000);
        caughtUp = true;
        await replayHistory(fromBlock).catch(() => {});
        lastPolledBlock = head;
        return;
      }
      const from = Math.max(lastPolledBlock + 1, head - POLL_WINDOW);
      const iface = contract.interface;
      const handlerMap = {
        PoolCreated: onPoolCreated,
        BetPlaced: onBetPlaced,
        PoolLocked: onPoolLocked,
        ResultProposed: onResultProposed,
        ResultDisputed: onResultDisputed,
        PoolFinalized: onPoolFinalized,
        PoolCancelled: onPoolCancelled,
        PayoutClaimed: onPayoutClaimed,
        RefundClaimed: onRefundClaimed,
      };
      const topics = Object.keys(handlerMap).map((n) => iface.getEvent(n).topicHash);
      const address = await withRpcBackoff(() => contract.getAddress());
      const logs = await withRpcBackoff(() =>
        provider.getLogs({ address, topics: [topics], fromBlock: from, toBlock: head })
      );
      for (const log of logs) {
        const parsed = iface.parseLog(log);
        if (!parsed) continue;
        const h = handlerMap[parsed.name];
        if (!h) continue;
        try {
          await h({ args: parsed.args, log });
        } catch (e) {
          console.error(`poll: ${parsed.name}:`, e.message);
        }
      }
      // Auto-lock expired open pools
      await autoLockExpiredPools(head).catch(() => {});
      lastPolledBlock = head;
    } catch (err) {
      const msg = (err?.info?.error?.message ?? err?.shortMessage ?? err?.message ?? "").toLowerCase();
      if (err?.info?.error?.code === 429 || msg.includes("compute units") || msg.includes("rate limit") || msg.includes("throughput")) {
        console.warn("poll: 429 from RPC after retries; will retry next tick");
      } else {
        console.error("poll: error:", err.message);
      }
    }
  };
  // Schedule repeatedly. Errors inside `tick` are caught, so this never throws.
  pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  // Also fire once after a short delay to catch up.
  setTimeout(tick, 1500);
}

function detachLiveHandlers() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  for (const h of liveHandlers) {
    try {
      h.removeListener?.();
    } catch {
      /* noop */
    }
  }
  liveHandlers = [];
}

// ---------- Event handlers ----------

async function onPoolCreated(evt) {
  cache.upsertPoolFromCreated({
    poolId: evt.args.poolId,
    creator: evt.args.creator,
    matchName: evt.args.matchName,
    stakeAmount: evt.args.stakeAmount,
    joinDeadline: evt.args.joinDeadline,
  });

  // Backfill outcomeLabels + disputeWindowSeconds, which events don't carry.
  try {
    const view = await contract.getPool(evt.args.poolId);
    cache.patchPoolMetadata(evt.args.poolId.toString(), {
      outcomeLabels: [view.outcome0, view.outcome1, view.outcome2],
      disputeWindowSeconds: Number(view.disputeWindowSeconds),
    });
  } catch (err) {
    console.error(`onPoolCreated: getPool(${evt.args.poolId}) failed:`, err.message);
  }
}

function onBetPlaced(evt) {
  cache.addParticipant(
    evt.args.poolId.toString(),
    evt.args.participant,
    evt.args.pick
  );
}

function onPoolLocked(evt) {
  cache.setStatus(evt.args.poolId.toString(), "locked");
}

function onResultProposed(evt) {
  cache.setProposal(
    evt.args.poolId.toString(),
    evt.args.result,
    // proposedAt isn't in the event args; we know the result was just set
    // now, so use the current block timestamp if available, else fall back
    // to Date.now() (slight drift is OK — the contract's own timestamp is
    // the source of truth, and the dispute window closes by the contract
    // clock, not ours).
    currentTimestamp()
  );
}

function onResultDisputed(evt) {
  cache.addDisputeVote(
    evt.args.poolId.toString(),
    evt.args.disputer,
    evt.args.theirResult
  );
}

function onPoolFinalized(evt) {
  cache.setFinalized(evt.args.poolId.toString(), evt.args.finalResult);
}

function onPoolCancelled(evt) {
  cache.setCancelled(evt.args.poolId.toString());
}

function onPayoutClaimed(evt) {
  cache.markClaimed(evt.args.poolId.toString(), evt.args.participant);
}

function onRefundClaimed(evt) {
  cache.markClaimed(evt.args.poolId.toString(), evt.args.participant);
}

function currentTimestamp() {
  // ethers v6 provider can return latest block; fall back to wall clock.
  try {
    // sync getter is fine here; not worth awaiting for live events.
    return Math.floor(Date.now() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

async function fastSyncFromContract() {
  // Read poolCount from the contract, then fetch each pool's data via
  // view functions. Much faster than scanning event logs through a
  // rate-limited public RPC.
  if (!contract) throw new Error("contract not initialized");
  const count = Number(await withRpcBackoff(() => contract.poolCount()));
  console.log(`listener: fast-sync: ${count} pools on chain`);
  for (let i = 0; i < count; i++) {
    try {
      const view = await withRpcBackoff(() => contract.getPool(i));
      cache.upsertPoolFromCreated({
        poolId: BigInt(i),
        creator: view.creator,
        matchName: view.matchName,
        stakeAmount: view.stakeAmount,
        joinDeadline: view.joinDeadline,
      });
      cache.patchPoolMetadata(String(i), {
        outcomeLabels: [view.outcome0, view.outcome1, view.outcome2],
        disputeWindowSeconds: Number(view.disputeWindowSeconds),
      });
      if (Number(view.status) >= 1) cache.setStatus(String(i), "locked");
      if (Number(view.status) >= 2) {
        cache.setProposal(String(i), Number(view.proposedResult), Number(view.proposedAt));
      }
      if (Number(view.status) >= 3) {
        if (Number(view.status) === 3) cache.setFinalized(String(i), Number(view.finalResult));
        else cache.setCancelled(String(i));
      }
      // Fetch participants
      try {
        const parts = await withRpcBackoff(() => contract.getParticipants(i));
        for (const addr of parts) {
          const pickData = await withRpcBackoff(() => contract.getParticipantPick(i, addr));
          cache.addParticipant(String(i), addr, Number(pickData.pick));
          if (pickData.claimed) cache.markClaimed(String(i), addr);
        }
      } catch { /* participant fetch failed, skip */ }
      console.log(`listener: fast-sync: pool ${i} (${view.matchName}) status=${Number(view.status)}`);
    } catch (err) {
      console.warn(`listener: fast-sync: pool ${i} failed:`, err.message);
    }
  }
  console.log(`listener: fast-sync complete: ${cache.getPoolCount()} pools cached`);
}

let lockSigner = null;

/// Initialize the lock signer from env var if available.
function getLockSigner() {
  if (lockSigner) return lockSigner;
  const pk = process.env.LOCK_SIGNER_PRIVATE_KEY;
  if (!pk) return null;
  try {
    lockSigner = new ethers.Wallet(pk, provider);
    return lockSigner;
  } catch {
    return null;
  }
}

/// Check all cached pools for any that are past their join deadline and still
/// open, and call lockPool on the contract using the lock signer. Since lockPool
/// is permissionless, any wallet with a small amount of MON for gas can do this.
async function autoLockExpiredPools(currentBlock) {
  const signer = getLockSigner();
  if (!signer) return;

  const contractWithSigner = new ethers.Contract(artifact.address, artifact.abi, signer);
  const now = Math.floor(Date.now() / 1000);

  const allPools = cache.getAllPools();
  for (const p of allPools) {
    if (p.status !== "open") continue;
    if (Number(p.joinDeadline) > now) continue;
    try {
      const tx = await contractWithSigner.lockPool(BigInt(p.id));
      console.log(`auto-lock: pool ${p.id} (${p.matchName}) tx: ${tx.hash}`);
      await tx.wait();
      console.log(`auto-lock: pool ${p.id} confirmed`);
    } catch (err) {
      // Expected if another tx already locked it — polling will pick up the event
      if (err.message?.includes("pool not open") || err.message?.includes("revert")) {
        // Already locked, nothing to do
      } else {
        console.warn(`auto-lock: pool ${p.id} failed:`, err.shortMessage ?? err.message);
      }
    }
  }
}

/// Attempt to (re)attach the listener with a 5s backoff. Used by the
/// top-level server.js on startup failure or RPC disconnect.
export async function runWithReconnect(opts) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await start(opts);
      return;
    } catch (err) {
      console.error(`listener: failed to start (${err.message}); retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

/// Watch the provider for network errors and try to re-subscribe.
export function watchAndReconnect(opts) {
  if (!provider) return;
  provider.on("error", async (err) => {
    console.error(`listener: provider error (${err?.message ?? err}); reconnecting in 5s`);
    detachLiveHandlers();
    await new Promise((r) => setTimeout(r, 5000));
    try {
      await start(opts);
      console.log("listener: reconnected");
    } catch (e) {
      console.error("listener: reconnect failed:", e.message);
    }
  });
}
