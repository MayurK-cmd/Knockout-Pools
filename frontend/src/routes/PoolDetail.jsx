import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import gsap from "gsap";
import { fetchPool, fetchPoolParticipants, fetchNames } from "../lib/pools.js";
import { formatMon, formatTimeLeft, shortenAddress, statusLabel, statusColor } from "../lib/format.js";
import { getDisplayName } from "../lib/nameUtils.js";
import GrainSquare from "../components/GrainSquare.jsx";
import ShareCard from "../components/ShareCard.jsx";
import {
  useJoinPool, useLockPool, useProposeResult, useDisputeResult,
  useFinalize, useClaimPayout, useClaimRefund,
} from "../lib/useContract.js";

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
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
      <h2 className="font-display text-lg font-bold text-mona-ink mb-4">Pool Lifecycle</h2>
      <div className="relative flex items-start justify-between">
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 z-0">
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
                    ? "border-red-400 bg-red-50 text-red-500"
                    : isPast
                    ? "border-mona-purple bg-mona-purple text-white"
                    : "border-gray-300 bg-white text-gray-400"
                } ${isActive ? "ring-2 ring-mona-purple ring-offset-2 ring-offset-white" : ""}`}
              >
                {i + 1}
              </div>
              <p className={`font-mono text-[10px] uppercase tracking-wider mt-2 text-center ${
                isCancelled && i <= 2 ? "text-red-500" : isPast ? "text-mona-ink" : "text-gray-400"
              }`}>
                {s.label}
              </p>
              <p className="font-mono text-[8px] text-gray-400 text-center mt-0.5">{s.desc}</p>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="mt-4 font-mono text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
          This pool was cancelled.
        </div>
      )}
    </div>
  );
}

function JoinSection({ pool }) {
  const { isConnected, address } = useAccount();
  const [pick, setPick] = useState(0);
  const { join, isPending } = useJoinPool();

  // Check if the current user has already joined
  const existingParticipant = address
    ? pool.participants?.find((p) => p.address?.toLowerCase() === address.toLowerCase())
    : null;
  const hasJoined = !!existingParticipant;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="font-display font-bold text-mona-ink mb-3">Join This Pool</h3>
      {!isConnected ? (
        <div className="text-center py-4">
          <p className="font-mono text-xs text-gray-500 mb-3">Connect your wallet to join</p>
          <ConnectButton />
        </div>
      ) : hasJoined ? (
        <div className="text-center py-2">
          <p className="font-mono text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 inline-block">
            You joined this pool — Pick {existingParticipant.pick + 1}: {pool.outcomeLabels?.[existingParticipant.pick] ?? "—"}
          </p>
        </div>
      ) : (
        <>
          <p className="font-mono text-xs text-gray-500 mb-3">Pick your outcome &amp; stake {formatMon(pool.stakeAmount)}</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {pool.outcomeLabels?.map((label, i) => (
              <button
                key={i}
                onClick={() => setPick(i)}
                className={`text-center px-2 py-3 rounded-lg border transition-colors cursor-pointer ${
                  pick === i
                    ? "bg-mona-purple/10 border-mona-purple text-mona-purple"
                    : "bg-white border-gray-200 text-gray-600 hover:text-mona-ink hover:border-gray-300"
                }`}
              >
                <span className="font-mono text-[10px] text-mona-purple block">Pick {i + 1}</span>
                <span className="font-body text-xs mt-0.5 block">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => join(pool.id, pick, pool.stakeAmount)}
            disabled={isPending}
            className={`w-full font-mono text-xs uppercase tracking-wider py-3 rounded-lg transition-all cursor-pointer ${
              isPending
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-mona-purple hover:bg-mona-purple/90 text-white shadow-sm hover:shadow-md"
            }`}
          >
            {isPending ? "Confirming…" : `Join with ${formatMon(pool.stakeAmount)}`}
          </button>
        </>
      )}
    </div>
  );
}

function LockSection({ pool }) {
  const { lock, isPending } = useLockPool();
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="font-display font-bold text-mona-ink mb-2">Lock Pool</h3>
      <p className="font-mono text-xs text-gray-500 mb-3">The join deadline has passed. Lock the pool to close joining.</p>
      <button
        onClick={() => lock(pool.id)}
        disabled={isPending}
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
          isPending
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-mona-purple hover:bg-mona-purple/90 text-white shadow-sm hover:shadow-md"
        }`}
      >
        {isPending ? "Confirming…" : "Lock Pool"}
      </button>
    </div>
  );
}

function ProposeSection({ pool }) {
  const { propose, isPending } = useProposeResult();
  const [selected, setSelected] = useState(null);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="font-display font-bold text-mona-ink mb-2">Propose Result</h3>
      <p className="font-mono text-xs text-gray-500 mb-3">The pool is locked. Propose the final result to start the dispute window.</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {pool.outcomeLabels?.map((label, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`text-center px-2 py-3 rounded-lg border transition-colors cursor-pointer ${
              selected === i
                ? "bg-mona-purple/10 border-mona-purple text-mona-purple"
                : "bg-white border-gray-200 text-gray-600 hover:text-mona-ink hover:border-gray-300"
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
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
          isPending || selected === null
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-mona-purple hover:bg-mona-purple/90 text-white shadow-sm hover:shadow-md"
        }`}
      >
        {isPending ? "Confirming…" : "Propose"}
      </button>
    </div>
  );
}

function DisputeSection({ pool }) {
  const { dispute, isPending } = useDisputeResult();
  const [selected, setSelected] = useState(null);
  const timeLeft = formatTimeLeft(pool.disputeWindowCloses);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="font-display font-bold text-mona-ink mb-1">Dispute Window</h3>
      <p className="font-mono text-xs text-mona-orange mb-3">
        {timeLeft === "Ended" ? "Window closed" : `${timeLeft} remaining`}
      </p>
      {timeLeft !== "Ended" && (
        <>
          <p className="font-mono text-xs text-gray-500 mb-3">Disagree with the proposed result? Cast your vote.</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {pool.outcomeLabels?.map((label, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`text-center px-2 py-3 rounded-lg border transition-colors cursor-pointer ${
                  selected === i
                    ? "bg-mona-orange/10 border-mona-orange text-mona-orange"
                    : "bg-white border-gray-200 text-gray-600 hover:text-mona-ink hover:border-gray-300"
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
            className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
              isPending || selected === null
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-mona-orange hover:bg-mona-orange/90 text-white shadow-sm hover:shadow-md"
            }`}
          >
            {isPending ? "Confirming…" : "Dispute"}
          </button>
        </>
      )}
    </div>
  );
}

function FinalizeSection({ pool }) {
  const { finalize, isPending } = useFinalize();
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="font-display font-bold text-mona-ink mb-2">Finalize</h3>
      <p className="font-mono text-xs text-gray-500 mb-3">The dispute window has closed. Finalize to settle the pool.</p>
      <button
        onClick={() => finalize(pool.id)}
        disabled={isPending}
        className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
          isPending
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md"
        }`}
      >
        {isPending ? "Confirming…" : "Finalize"}
      </button>
    </div>
  );
}

function ClaimSection({ pool, address }) {
  const { claim, isPending: claimPending } = useClaimPayout();
  const { refund, isPending: refundPending } = useClaimRefund();

  // Check if the connected user is a participant and if they won
  const userParticipant = address
    ? pool.participants?.find((p) => p.address?.toLowerCase() === address.toLowerCase())
    : null;
  const isWinner = userParticipant && pool.finalResult !== null && userParticipant.pick === pool.finalResult;
  const isLoser = userParticipant && pool.finalResult !== null && userParticipant.pick !== pool.finalResult;
  const alreadyClaimed = userParticipant?.claimed;

  if (pool.status === "finalized") {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
          isWinner ? "bg-green-100" : isLoser ? "bg-red-100" : "bg-gray-100"
        }`}>
          <span className={`${isWinner ? "text-green-600" : isLoser ? "text-red-500" : "text-gray-500"} text-xl`}>
            {isWinner ? "✓" : "✕"}
          </span>
        </div>
        <h3 className="font-display font-bold text-mona-ink mb-1">Pool Finalized</h3>
        <p className="font-mono text-xs text-gray-500 mb-3">
          Winner: {pool.outcomeLabels?.[pool.finalResult] ?? `Pick ${pool.finalResult + 1}`}
        </p>

        {isWinner && !alreadyClaimed && (
          <button
            onClick={() => claim(pool.id)}
            disabled={claimPending}
            className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
              claimPending
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md"
            }`}
          >
            {claimPending ? "Confirming…" : "Claim Payout"}
          </button>
        )}
        {isWinner && alreadyClaimed && (
          <p className="font-mono text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2 inline-block">Payout claimed ✓</p>
        )}
        {isLoser && (
          <p className="font-mono text-xs text-gray-500">You picked {pool.outcomeLabels?.[userParticipant.pick] ?? `Pick ${userParticipant.pick + 1}`}. Better luck next time.</p>
        )}
        {!userParticipant && (
          <p className="font-mono text-xs text-gray-400">You were not a participant in this pool.</p>
        )}
        {/* Share card for finalized pools */}
        <ShareCard pool={pool} address={address} />
      </div>
    );
  }

  if (pool.status === "cancelled") {
    const alreadyRefunded = userParticipant?.claimed;
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-red-500 text-xl">✕</span>
        </div>
        <h3 className="font-display font-bold text-mona-ink mb-1">Pool Cancelled</h3>
        {userParticipant && !alreadyRefunded && (
          <>
            <p className="font-mono text-xs text-gray-500 mb-3">Your stake will be refunded.</p>
            <button
              onClick={() => refund(pool.id)}
              disabled={refundPending}
              className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all cursor-pointer ${
                refundPending
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-100 hover:bg-gray-200 text-mona-ink shadow-sm hover:shadow-md"
              }`}
            >
              {refundPending ? "Confirming…" : "Claim Refund"}
            </button>
          </>
        )}
        {userParticipant && alreadyRefunded && (
          <p className="font-mono text-xs text-gray-500">Refund claimed ✓</p>
        )}
        {!userParticipant && (
          <p className="font-mono text-xs text-gray-400 mb-3">This pool was cancelled.</p>
        )}
      </div>
    );
  }

  return null;
}

function PoolDetail() {
  const { id } = useParams();
  const { address } = useAccount();
  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantNames, setParticipantNames] = useState({});
  const payoutRef = useRef(null);

  const loadPool = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      try {
        const data = await fetchPool(id);
        setPool(data);
        const parts = await fetchPoolParticipants(id);
        setParticipants(parts);
        // Fetch names for all participants
        const addresses = parts.map((p) => p.address).filter(Boolean);
        if (addresses.length) {
          fetchNames(addresses).then(setParticipantNames).catch(() => {});
        }
        setLoading(false);
        return;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) {
          setError(err.message);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }, [id]);

  useEffect(() => {
    loadPool();
    const interval = setInterval(loadPool, 8000);
    return () => clearInterval(interval);
  }, [loadPool]);

  useEffect(() => {
    if (pool?.status === "finalized" && payoutRef.current) {
      gsap.from(payoutRef.current, { scale: 0.8, opacity: 0, duration: 0.6, ease: "back.out(1.7)" });
    }
  }, [pool?.status]);

  // Auto-lock if pool is past deadline and still open — triggered on each poll
  const { lock: autoLock, isPending: isLocking } = useLockPool();
  useEffect(() => {
    if (pool && pool.status === "open" && pool.joinDeadline < Math.floor(Date.now() / 1000)) {
      autoLock(pool.id);
    }
  }, [pool?.id, pool?.status, pool?.joinDeadline]);

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
        <p className="text-red-500 font-mono text-sm">{error || "Pool not found"}</p>
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
      {/* Back link outside the card */}
      <Link to="/" className="font-mono text-xs text-gray-400 hover:text-mona-purple no-underline transition-colors mb-4 inline-block">
        ← All Pools
      </Link>

      {/* Single white card with decorative grain squares */}
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-8 overflow-hidden">
        {/* Decorative grain squares — animated */}
        <div className="absolute -top-8 -right-8 pointer-events-none">
          <GrainSquare className="w-36 h-36" />
        </div>
        <div className="absolute -bottom-8 -left-8 pointer-events-none">
          <GrainSquare className="w-28 h-28" />
        </div>
        <div className="absolute top-1/2 -left-4 pointer-events-none">
          <GrainSquare className="w-16 h-16" />
        </div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-mona-ink">{pool.matchName}</h1>
            <span
              className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap font-semibold"
              style={{ backgroundColor: `${statusColor(pool.status)}22`, color: statusColor(pool.status) }}
            >
              {statusLabel(pool.status)}
            </span>
          </div>
          <p className="font-mono text-xs text-gray-500">
            Created by {shortenAddress(pool.creator)} · Pot: {pot} · {pool.participantCount} participant{pool.participantCount !== 1 ? "s" : ""}
          </p>
        </div>

        <StateMachineTimeline status={pool.status} />

        {/* Pool info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">Stake</p>
            <p className="font-mono text-sm font-semibold text-mona-ink">{formatMon(pool.stakeAmount)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total Pot</p>
            <p className="font-mono text-sm font-semibold text-mona-ink">{pot}</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">Participants</p>
            <p className="font-mono text-sm font-semibold text-mona-ink">{pool.participantCount || 0}</p>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-1">Deadline</p>
            <p className="font-mono text-sm font-semibold text-mona-ink">{formatTimeLeft(pool.joinDeadline)}</p>
          </div>
        </div>

        {/* Pick distribution */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6 mb-6">
          <h3 className="font-display font-bold text-mona-ink mb-3">Pick Distribution</h3>
          {pool.pickCounts && pool.outcomeLabels ? (
            <div className="space-y-2">
              {pool.outcomeLabels.map((label, i) => {
                const count = pool.pickCounts[i] || 0;
                const total = (pool.pickCounts[0] || 0) + (pool.pickCounts[1] || 0) + (pool.pickCounts[2] || 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between font-mono text-xs mb-1">
                      <span className="text-gray-700">{label}</span>
                      <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
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
            <p className="font-mono text-xs text-gray-400">No picks yet.</p>
          )}
        </div>

        {/* Action sections */}
        <div className="space-y-4 mb-6">
          {pool.status === "open" && <JoinSection pool={pool} />}
          {pool.status === "open" && pool.joinDeadline < Math.floor(Date.now() / 1000) && <LockSection pool={pool} />}
          {pool.status === "locked" && <ProposeSection pool={pool} />}
          {pool.status === "dispute_window" && <DisputeSection pool={pool} />}
          {pool.status === "dispute_window" && <FinalizeSection pool={pool} />}
          {(pool.status === "finalized" || pool.status === "cancelled") && (
            <div ref={payoutRef}>
              <ClaimSection pool={pool} address={address} />
            </div>
          )}
        </div>

        {/* Participants list */}
        {participants.length > 0 && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="font-display font-bold text-mona-ink mb-3">Participants ({participants.length})</h3>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                  <span className="font-mono text-xs text-gray-700">
                    {address && p.address?.toLowerCase() === address.toLowerCase()
                      ? (getDisplayName(address) || "You")
                      : (participantNames[p.address] || shortenAddress(p.address))}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {pool.outcomeLabels?.[p.pick] ?? `Pick ${(p.pick ?? 0) + 1}`}
                    {p.claimed ? " · Claimed" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PoolDetail;
