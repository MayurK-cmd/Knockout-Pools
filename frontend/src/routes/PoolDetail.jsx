import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "motion/react";
import { useSpring, animated } from "react-spring";
import gsap from "gsap";
import { fetchPool, fetchPoolParticipants } from "../lib/pools.js";
import { formatMon, formatTimeLeft, shortenAddress, statusLabel, statusColor } from "../lib/format.js";
import {
  useJoinPool, useLockPool, useProposeResult, useDisputeResult,
  useFinalize, useClaimPayout, useClaimRefund,
} from "../lib/useContract.js";

// ── State machine config ──
const STATES = [
  { key: "open", label: "Open", desc: "Joining open" },
  { key: "locked", label: "Locked", desc: "Joining closed" },
  { key: "dispute_window", label: "Dispute", desc: "Result proposed" },
  { key: "finalized", label: "Finalized", desc: "Pool resolved" },
];

const STATUS_ORDER = { open: 0, locked: 1, dispute_window: 2, finalized: 3, cancelled: -1 };

function StateMachineTimeline({ status }) {
  const activeIndex = STATUS_ORDER[status];
  const isCancelled = status === "cancelled";

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-white mb-4">Pool Lifecycle</h2>
      <div className="relative flex items-start justify-between">
        {/* Connecting line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-white/10 z-0">
          <div
            className="h-full bg-mona-purple transition-all duration-700"
            style={{ width: isCancelled ? "0%" : `${Math.max(0, (activeIndex / (STATES.length - 1)) * 100)}%` }}
          />
        </div>

        {STATES.map((s, i) => {
          const isPast = !isCancelled && i <= activeIndex;
          const isActive = !isCancelled && i === activeIndex;
          return (
            <div key={s.key} className="flex flex-col items-center z-10 relative" style={{ width: 80 }}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold border-2 transition-all duration-500 ${
                  isCancelled && i <= 2
                    ? "border-red-500 bg-red-500/20 text-red-400"
                    : isPast
                    ? "border-mona-purple bg-mona-purple text-white"
                    : "border-white/20 bg-white/5 text-white/30"
                } ${isActive ? "ring-2 ring-mona-purple ring-offset-2 ring-offset-mona-ink" : ""}`}
              >
                {i + 1}
              </div>
              <p className={`font-mono text-[10px] uppercase tracking-wider mt-2 text-center ${
                isCancelled && i <= 2 ? "text-red-400" : isPast ? "text-white" : "text-white/30"
              }`}>
                {s.label}
              </p>
              <p className="font-mono text-[8px] text-white/30 text-center mt-0.5">{s.desc}</p>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-4 font-mono text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-center">
          This pool was cancelled.
        </div>
      )}
    </div>
  );
}

// ── Join section ──
function JoinSection({ pool, onRefresh }) {
  const { isConnected, address } = useAccount();
  const [pick, setPick] = useState(0);
  const { join, isPending } = useJoinPool();

  const handleJoin = () => {
    join(pool.id, pick, pool.stakeAmount);
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
      <h3 className="font-display font-bold text-white mb-3">Join This Pool</h3>
      {!isConnected ? (
        <div className="text-center py-4">
          <p className="font-mono text-xs text-white/50 mb-3">Connect your wallet to join</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <p className="font-mono text-xs text-white/50 mb-3">Pick your outcome &amp; stake {formatMon(pool.stakeAmount)}</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {pool.outcomeLabels?.map((label, i) => (
              <button
                key={i}
                onClick={() => setPick(i)}
                className={`text-center px-2 py-3 rounded-lg border transition-colors ${
                  pick === i
                    ? "bg-mona-purple/20 border-mona-purple text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/30"
                }`}
              >
                <span className="font-mono text-[10px] text-mona-purple block">Pick {i + 1}</span>
                <span className="font-body text-xs mt-0.5 block">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleJoin}
            disabled={isPending}
            className={`w-full font-mono text-xs uppercase tracking-wider py-3 rounded-lg transition-colors ${
              isPending
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-mona-purple hover:bg-mona-purple/80 text-white cursor-pointer"
            }`}
          >
            {isPending ? "Confirming…" : `Join with ${formatMon(pool.stakeAmount)}`}
          </button>
        </>
      )}
    </div>
  );
}

// ── Lock section ──
function LockSection({ pool, onRefresh }) {
  const { lock, isPending } = useLockPool();
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
      <h3 className="font-display font-bold text-white mb-2">Lock Pool</h3>
      <p className="font-mono text-xs text-white/50 mb-3">The join deadline has passed. Lock the pool to close joining.</p>
      <button
        onClick={() => lock(pool.id)}
        disabled={isPending}
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
          isPending
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : "bg-mona-purple hover:bg-mona-purple/80 text-white cursor-pointer"
        }`}
      >
        {isPending ? "Confirming…" : "Lock Pool"}
      </button>
    </div>
  );
}

// ── Propose section ──
function ProposeSection({ pool, onRefresh }) {
  const { propose, isPending } = useProposeResult();
  const [selected, setSelected] = useState(null);

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
      <h3 className="font-display font-bold text-white mb-2">Propose Result</h3>
      <p className="font-mono text-xs text-white/50 mb-3">The pool is locked. Propose the final result to start the dispute window.</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {pool.outcomeLabels?.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`text-center px-2 py-3 rounded-lg border transition-colors ${
              selected === i
                ? "bg-mona-purple/20 border-mona-purple text-white"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/30"
            }`}
          >
            <span className="font-mono text-[10px] text-mona-purple block">Pick {i + 1}</span>
            <span className="font-body text-xs mt-0.5 block">{label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => selected !== null && propose(pool.id, selected)}
        disabled={isPending || selected === null}
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
          isPending || selected === null
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : "bg-mona-purple hover:bg-mona-purple/80 text-white cursor-pointer"
        }`}
      >
        {isPending ? "Confirming…" : "Propose"}
      </button>
    </div>
  );
}

// ── Dispute section ──
function DisputeSection({ pool, onRefresh }) {
  const { dispute, isPending } = useDisputeResult();
  const [selected, setSelected] = useState(null);
  const timeLeft = formatTimeLeft(pool.disputeWindowCloses);

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
      <h3 className="font-display font-bold text-white mb-1">Dispute Window</h3>
      <p className="font-mono text-xs text-mona-orange mb-3">
        {timeLeft === "Ended" ? "Window closed" : `${timeLeft} remaining`}
      </p>
      {timeLeft !== "Ended" && (
        <>
          <p className="font-mono text-xs text-white/50 mb-3">
            Disagree with the proposed result? Cast your vote.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {pool.outcomeLabels?.map((label, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`text-center px-2 py-3 rounded-lg border transition-colors ${
                  selected === i
                    ? "bg-mona-orange/20 border-mona-orange text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/30"
                }`}
              >
                <span className="font-mono text-[10px] text-mona-orange block">Pick {i + 1}</span>
                <span className="font-body text-xs mt-0.5 block">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => selected !== null && dispute(pool.id, selected)}
            disabled={isPending || selected === null}
            className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
              isPending || selected === null
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-mona-orange hover:bg-mona-orange/80 text-white cursor-pointer"
            }`}
          >
            {isPending ? "Confirming…" : "Dispute"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Finalize section ──
function FinalizeSection({ pool, onRefresh }) {
  const { finalize, isPending } = useFinalize();
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
      <h3 className="font-display font-bold text-white mb-2">Finalize</h3>
      <p className="font-mono text-xs text-white/50 mb-3">The dispute window has closed. Finalize to settle the pool.</p>
      <button
        onClick={() => finalize(pool.id)}
        disabled={isPending}
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
          isPending
            ? "bg-white/10 text-white/40 cursor-not-allowed"
            : "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
        }`}
      >
        {isPending ? "Confirming…" : "Finalize"}
      </button>
    </div>
  );
}

// ── Claim section ──
function ClaimSection({ pool, address }) {
  const { claim, isPending: claimPending } = useClaimPayout();
  const { refund, isPending: refundPending } = useClaimRefund();
  const win = pool.finalResult !== null && pool.finalResult !== undefined;

  // Check if user is a winner (simplified — real check via getParticipantPick)
  const isWinner = false; // Placeholder; real check needs user's pick

  if (pool.status === "finalized") {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-green-400 text-xl">✓</span>
        </div>
        <h3 className="font-display font-bold text-white mb-1">Pool Finalized</h3>
        <p className="font-mono text-xs text-white/50 mb-3">
          Winner: {pool.outcomeLabels?.[pool.finalResult] ?? `Pick ${pool.finalResult + 1}`}
        </p>
        <button
          onClick={() => claim(pool.id)}
          disabled={claimPending}
          className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
            claimPending
              ? "bg-white/10 text-white/40 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
          }`}
        >
          {claimPending ? "Confirming…" : "Claim Payout"}
        </button>
      </div>
    );
  }

  if (pool.status === "cancelled") {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-400 text-xl">✕</span>
        </div>
        <h3 className="font-display font-bold text-white mb-1">Pool Cancelled</h3>
        <p className="font-mono text-xs text-white/50 mb-3">Your stake will be refunded.</p>
        <button
          onClick={() => refund(pool.id)}
          disabled={refundPending}
          className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors ${
            refundPending
              ? "bg-white/10 text-white/40 cursor-not-allowed"
              : "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          }`}
        >
          {refundPending ? "Confirming…" : "Claim Refund"}
        </button>
      </div>
    );
  }

  return null;
}

// ── PoolDetail page ──
function PoolDetail() {
  const { id } = useParams();
  const { isConnected, address } = useAccount();
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const refreshRef = useRef(0);

  // GSAP animation for payout reveal
  const payoutRef = useRef(null);

  const loadPool = useCallback(async () => {
    try {
      const data = await fetchPool(id);
      setPool(data);
      const parts = await fetchPoolParticipants(id);
      setParticipants(parts);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPool();
    // Poll every 10s
    const interval = setInterval(loadPool, 10000);
    return () => clearInterval(interval);
  }, [loadPool]);

  useEffect(() => {
    if (pool?.status === "finalized" && payoutRef.current) {
      gsap.from(payoutRef.current, { scale: 0.8, opacity: 0, duration: 0.6, ease: "back.out(1.7)" });
    }
  }, [pool?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-mona-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 font-mono text-sm">{error || "Pool not found"}</p>
        <Link to="/" className="inline-block mt-4 font-mono text-xs uppercase tracking-wider text-mona-purple hover:text-mona-purple/80 no-underline">
          ← Back to pools
        </Link>
      </div>
    );
  }

  const pot = pool.stakeAmount && pool.participantCount
    ? formatMon(BigInt(pool.stakeAmount) * BigInt(pool.participantCount))
    : "—";

  return (
    <div>
      <Link to="/" className="font-mono text-xs text-white/40 hover:text-white/70 no-underline transition-colors mb-4 inline-block">
        ← All Pools
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">{pool.matchName}</h1>
          <span
            className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap"
            style={{ backgroundColor: `${statusColor(pool.status)}22`, color: statusColor(pool.status) }}
          >
            {statusLabel(pool.status)}
          </span>
        </div>
        <p className="font-mono text-xs text-white/40">
          Created by {shortenAddress(pool.creator)} · Pot: {pot} · {pool.participantCount} participant{pool.participantCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* State machine timeline */}
      <StateMachineTimeline status={pool.status} />

      {/* Pool info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Stake</p>
          <p className="font-mono text-sm font-semibold text-white">{formatMon(pool.stakeAmount)}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Total Pot</p>
          <p className="font-mono text-sm font-semibold text-white">{pot}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Participants</p>
          <p className="font-mono text-sm font-semibold text-white">{pool.participantCount || 0}</p>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mb-1">Deadline</p>
          <p className="font-mono text-sm font-semibold text-white">{formatTimeLeft(pool.joinDeadline)}</p>
        </div>
      </div>

      {/* Pick distribution */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6 mb-6">
        <h3 className="font-display font-bold text-white mb-3">Pick Distribution</h3>
        {pool.pickCounts && pool.outcomeLabels ? (
          <div className="space-y-2">
            {pool.outcomeLabels.map((label, i) => {
              const count = pool.pickCounts[i] || 0;
              const total = (pool.pickCounts[0] || 0) + (pool.pickCounts[1] || 0) + (pool.pickCounts[2] || 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between font-mono text-xs mb-1">
                    <span className="text-white/70">{label}</span>
                    <span className="text-white/50">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: statusColor(i === 0 ? "open" : i === 1 ? "locked" : "dispute_window") }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-xs text-white/30">No picks yet.</p>
        )}
      </div>

      {/* Action sections */}
      <div className="space-y-4 mb-6">
        {pool.status === "open" && <JoinSection pool={pool} onRefresh={loadPool} />}
        {pool.status === "open" && pool.joinDeadline < Math.floor(Date.now() / 1000) && <LockSection pool={pool} onRefresh={loadPool} />}
        {pool.status === "locked" && <ProposeSection pool={pool} onRefresh={loadPool} />}
        {pool.status === "dispute_window" && <DisputeSection pool={pool} onRefresh={loadPool} />}
        {pool.status === "dispute_window" && <FinalizeSection pool={pool} onRefresh={loadPool} />}
        {(pool.status === "finalized" || pool.status === "cancelled") && (
          <div ref={payoutRef}>
            <ClaimSection pool={pool} address={address} />
          </div>
        )}
      </div>

      {/* Participants list */}
      {participants.length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 sm:p-6">
          <h3 className="font-display font-bold text-white mb-3">Participants ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="font-mono text-xs text-white/70">{shortenAddress(p.address)}</span>
                <span className="font-mono text-xs text-white/50">
                  {pool.outcomeLabels?.[p.pick] ?? `Pick ${(p.pick ?? 0) + 1}`}
                  {p.claimed ? " · Claimed" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in a dark-themed section so it works over the white gradient
export default function PoolDetailPage(props) {
  return (
    <div className="rounded-xl bg-[#0e091c] text-white overflow-hidden p-4 sm:p-6">
      <PoolDetail {...props} />
    </div>
  );
}
