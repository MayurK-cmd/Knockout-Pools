// Read-only routes. All writes happen directly on-chain from the frontend;
// this layer is a fast read cache backed by event history.

import { Router } from "express";
import * as cache from "../cache.js";
import { getContract, getProvider } from "../listener.js";

const router = Router();

const STATUS_ALIASES = {
  open: "open",
  locked: "locked",
  awaiting_result: "dispute_window", // alias per spec
  awaitingresult: "dispute_window",
  dispute_window: "dispute_window",
  dispute: "dispute_window",
  finalized: "finalized",
  cancelled: "cancelled",
  canceled: "cancelled",
};

const VALID_STATUSES = Object.keys(STATUS_ALIASES);

function projectPool(p) {
  return {
    id: p.id,
    matchName: p.matchName,
    outcomeLabels: p.outcomeLabels,
    stakeAmount: p.stakeAmount,
    joinDeadline: p.joinDeadline,
    disputeWindowSeconds: p.disputeWindowSeconds,
    status: p.status,
    participants: p.participants,
    proposedResult: p.proposedResult,
    proposedAt: p.proposedAt,
    disputeWindowCloses: p.disputeWindowCloses,
    disputed: p.disputed,
    finalResult: p.finalResult,
    creator: p.creator,
    participantCount: p.participantCount,
    pickCounts: p.pickCounts,
  };
}

// GET /api/pools?status=open
router.get("/pools", (req, res) => {
  const rawStatus = req.query.status;
  let pools = cache.getAllPools();
  if (rawStatus) {
    const canonical = STATUS_ALIASES[String(rawStatus).toLowerCase()];
    if (!canonical) {
      return res.status(400).json({
        error: `invalid status "${rawStatus}"`,
        valid: VALID_STATUSES,
      });
    }
    pools = pools.filter((p) => p.status === canonical);
  }
  pools.sort((a, b) => b.joinDeadline - a.joinDeadline);
  res.json(pools.map(projectPool));
});

// GET /api/pools/:id
router.get("/pools/:id", (req, res) => {
  const p = cache.getPool(req.params.id);
  if (!p) return res.status(404).json({ error: "pool not found" });
  res.json(projectPool(p));
});

// GET /api/pools/:id/participants
router.get("/pools/:id/participants", (req, res) => {
  const p = cache.getPool(req.params.id);
  if (!p) return res.status(404).json({ error: "pool not found" });
  res.json(p.participants);
});

export default router;
export { projectPool };
