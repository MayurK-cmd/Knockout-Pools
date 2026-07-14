// In-memory cache for pools. Single source of truth for reads is the chain;
// this map is a derived view populated by the event listener on startup and
// kept warm by the live subscription.

const pools = new Map();

// Status enum from the contract: 0=OPEN 1=LOCKED 2=DISPUTE_WINDOW 3=FINALIZED 4=CANCELLED
// Lowercase strings used for the API per spec.
const STATUS_NAMES = ["open", "locked", "dispute_window", "finalized", "cancelled"];

export function statusName(uint8) {
  return STATUS_NAMES[Number(uint8)] ?? "unknown";
}

/// Create a new pool entry from a PoolCreated event.
/// Other event handlers should mutate this entry in place.
export function upsertPoolFromCreated(evt) {
  const id = evt.poolId.toString();
  const entry = {
    id,
    matchName: evt.matchName,
    outcomeLabels: ["", "", ""], // filled in by view-pool refresh (event doesn't carry labels)
    stakeAmount: evt.stakeAmount.toString(),
    joinDeadline: Number(evt.joinDeadline),
    disputeWindowSeconds: 0, // filled in by view-pool refresh
    status: "open",
    participants: [],
    proposedResult: null,
    proposedAt: null,
    disputeWindowCloses: null,
    disputed: false,
    finalResult: null,
    creator: evt.creator,
    participantCount: 0,
    pickCounts: [0, 0, 0],
  };
  pools.set(id, entry);
  return entry;
}

export function addParticipant(poolId, address, pick) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.participants.push({ address, pick: Number(pick), claimed: false });
  p.participantCount = p.participants.length;
  recomputePickCounts(p);
  return p;
}

export function setStatus(poolId, status) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.status = status;
  return p;
}

export function setProposal(poolId, result, proposedAt) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.proposedResult = Number(result);
  p.proposedAt = Number(proposedAt);
  p.disputeWindowCloses = Number(proposedAt) + p.disputeWindowSeconds;
  p.status = "dispute_window";
  return p;
}

export function addDisputeVote(poolId, address, result) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.disputed = true;
  // Track the dispute vote alongside participants so the API can show it.
  // We attach it to the matching participant entry if present; otherwise
  // store on a free-standing array.
  if (!p.disputeVotes) p.disputeVotes = [];
  p.disputeVotes.push({ address, result: Number(result) });
  return p;
}

export function setFinalized(poolId, result) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.finalResult = Number(result);
  p.status = "finalized";
  return p;
}

export function setCancelled(poolId) {
  const p = pools.get(poolId);
  if (!p) return null;
  p.status = "cancelled";
  return p;
}

export function markClaimed(poolId, address) {
  const p = pools.get(poolId);
  if (!p) return null;
  const part = p.participants.find((x) => x.address.toLowerCase() === address.toLowerCase());
  if (part) part.claimed = true;
  return p;
}

/// Backfill fields the events don't carry (outcomeLabels, disputeWindowSeconds).
/// Called right after a PoolCreated event is processed.
export function patchPoolMetadata(poolId, partial) {
  const p = pools.get(poolId);
  if (!p) return null;
  if (partial.outcomeLabels) p.outcomeLabels = partial.outcomeLabels;
  if (typeof partial.disputeWindowSeconds === "number") {
    p.disputeWindowSeconds = partial.disputeWindowSeconds;
    if (p.proposedAt) {
      p.disputeWindowCloses = p.proposedAt + partial.disputeWindowSeconds;
    }
  }
  return p;
}

function recomputePickCounts(p) {
  const counts = [0, 0, 0];
  for (const part of p.participants) {
    const i = Number(part.pick);
    if (i >= 0 && i < 3) counts[i] += 1;
  }
  p.pickCounts = counts;
}

// ---------- Accessors ----------
export function getPool(id) {
  return pools.get(String(id)) ?? null;
}

export function getAllPools() {
  return Array.from(pools.values());
}

export function getPoolsByStatus(status) {
  return getAllPools().filter((p) => p.status === status);
}

export function getPoolCount() {
  return pools.size;
}
