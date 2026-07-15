import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import { useSpring, animated } from "react-spring";
import { useCreatePool } from "../lib/useContract.js";
import { decodeEventLog } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../lib/pools.js";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select.jsx";
import {
  Field, FieldLabel, FieldContent, FieldError,
} from "@/components/ui/field.jsx";

const SPORTS = [
  { id: "football", label: "Football", matches: ["Manchester United vs Liverpool", "Barcelona vs Real Madrid", "Arsenal vs Chelsea", "Bayern Munich vs Borussia Dortmund", "AC Milan vs Inter Milan"] },
  { id: "cricket", label: "Cricket", matches: ["India vs Australia", "England vs Pakistan", "South Africa vs New Zealand", "West Indies vs Sri Lanka", "IPL: Mumbai Indians vs CSK"] },
  { id: "formula1", label: "Formula 1", matches: ["Monaco Grand Prix", "British Grand Prix", "Italian Grand Prix", "Singapore Grand Prix", "Abu Dhabi Grand Prix"] },
  { id: "basketball", label: "Basketball", matches: ["Lakers vs Celtics", "Warriors vs Bucks", "Nuggets vs Heat", "Knicks vs Bulls", "Thunder vs Mavericks"] },
  { id: "tennis", label: "Tennis", matches: ["Wimbledon: Final", "US Open: Final", "Australian Open: Final", "French Open: Final", "Davis Cup: Final"] },
];

export default function CreatePool() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const { create, isPending, txHash } = useCreatePool();
  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [sport, setSport] = useState("football");
  const [matchName, setMatchName] = useState("");
  const [customMatch, setCustomMatch] = useState("");
  const [stakeAmount, setStakeAmount] = useState("1");
  const [deadlineHours, setDeadlineHours] = useState("2");
  const [deadlineMinutes, setDeadlineMinutes] = useState("0");
  const [disputeWindowMin, setDisputeWindowMin] = useState("10");
  const [outcomes, setOutcomes] = useState(["Home Win", "Draw", "Away Win"]);
  const [error, setError] = useState("");
  const [createdPoolId, setCreatedPoolId] = useState(null);

  const [submitSpring, api] = useSpring(() => ({ scale: 1 }));

  // Extract pool ID from the PoolCreated event once receipt confirms
  useEffect(() => {
    if (!isConfirmed || !receipt) return;
    const poolCreatedEvent = CONTRACT_ABI.find((e) => e.name === "PoolCreated");
    if (!poolCreatedEvent) { navigate("/"); return; }

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: [poolCreatedEvent], data: log.data, topics: log.topics });
        if (decoded.eventName === "PoolCreated") {
          const poolId = Number(decoded.args.poolId);
          setCreatedPoolId(poolId);
          navigate(`/pool/${poolId}`);
          return;
        }
      } catch { /* skip logs that don't match */ }
    }
    // Fallback: if no event found, go to pool list
    navigate("/");
  }, [isConfirmed, receipt, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isConnected) { setError("Connect your wallet first."); return; }
    if (!matchName && !customMatch) { setError("Select or enter a match."); return; }
    if (outcomes.some((o) => !o.trim())) { setError("Fill in all three outcome labels."); return; }

    const finalMatch = customMatch || matchName;
    const stakeWei = BigInt(Math.floor(parseFloat(stakeAmount) * 1e18)).toString();
    const totalMinutes = parseInt(deadlineHours) * 60 + parseInt(deadlineMinutes);
    const deadline = (Math.floor(Date.now() / 1000) + totalMinutes * 60).toString();
    const disputeSeconds = (parseInt(disputeWindowMin) * 60).toString();

    api.start({ scale: 0.95 });
    setTimeout(() => api.start({ scale: 1 }), 150);

    try {
      create(finalMatch, outcomes, stakeWei, deadline, disputeSeconds);
    } catch (err) {
      setError(err?.shortMessage || err.message || "Transaction failed");
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-mona-ink mb-2">Create a Pool</h1>
        <p className="font-mono text-xs text-gray-500 mb-8">
          Set the terms. Your stake goes into the contract — nobody can move it except by the rules.
        </p>
      </motion.div>

      {!isConnected ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <p className="font-body text-sm text-gray-500 mb-4">Connect your wallet to create a pool</p>
          <ConnectButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sport */}
          <Field>
            <FieldLabel>Sport</FieldLabel>
            <FieldContent>
              <Select value={sport} onValueChange={(v) => { setSport(v); setMatchName(""); setCustomMatch(""); }}>
                <SelectTrigger className="w-full cursor-pointer">
                  <span className="text-gray-900 text-sm">{SPORTS.find(s => s.id === sport)?.label || sport}</span>
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          {/* Match */}
          <Field>
            <FieldLabel>Match</FieldLabel>
            <FieldContent>
              <div className="grid grid-cols-1 gap-1 mb-2">
                {SPORTS.find((s) => s.id === sport)?.matches.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMatchName(m); setCustomMatch(""); }}
                    className={`text-left px-3 py-2 rounded-lg font-body text-sm border transition-colors cursor-pointer ${
                      matchName === m
                        ? "bg-mona-purple/10 border-mona-purple text-mona-purple"
                        : "bg-white border-gray-200 text-gray-600 hover:text-mona-ink hover:border-gray-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or type a custom match name…"
                value={customMatch}
                onChange={(e) => { setCustomMatch(e.target.value); if (e.target.value) setMatchName(""); }}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-body text-sm text-mona-ink placeholder-gray-400 focus:outline-none focus:border-mona-purple"
              />
            </FieldContent>
          </Field>

          {/* Stake */}
          <Field>
            <FieldLabel>Stake (MON)</FieldLabel>
            <FieldContent>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-mono text-sm text-mona-ink focus:outline-none focus:border-mona-purple"
              />
            </FieldContent>
          </Field>

          {/* Outcomes */}
          <Field>
            <FieldLabel>Outcomes</FieldLabel>
            <FieldContent>
              <div className="grid grid-cols-3 gap-2">
                {outcomes.map((o, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <span className="font-mono text-[10px] text-mona-purple block mb-1">Pick {i + 1}</span>
                    <input
                      type="text"
                      value={outcomes[i]}
                      onChange={(e) => {
                        const next = [...outcomes];
                        next[i] = e.target.value;
                        setOutcomes(next);
                      }}
                      placeholder={`Outcome ${i + 1}`}
                      className="w-full bg-transparent border-none font-body text-sm text-mona-ink placeholder-gray-400 focus:outline-none p-0"
                    />
                  </div>
                ))}
              </div>
            </FieldContent>
          </Field>

          {/* Join deadline */}
          <Field>
            <FieldLabel>Join Deadline</FieldLabel>
            <FieldContent>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <Select value={deadlineHours} onValueChange={setDeadlineHours}>
                  <SelectTrigger className="w-full cursor-pointer">
                    <span className="text-gray-900 text-sm">{deadlineHours}h</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 73 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{i} hour{i !== 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="font-body text-sm text-gray-400">and</span>
                <Select value={deadlineMinutes} onValueChange={setDeadlineMinutes}>
                  <SelectTrigger className="w-full cursor-pointer">
                    <span className="text-gray-900 text-sm">{deadlineMinutes}m</span>
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 20, 30, 45].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="font-mono text-[11px] text-gray-400 mt-1">
                Joins close {parseInt(deadlineHours) > 0 || parseInt(deadlineMinutes) > 0
                  ? `in ${deadlineHours}h ${deadlineMinutes}m`
                  : "immediately"}
              </p>
            </FieldContent>
          </Field>

          {/* Dispute window */}
          <Field>
            <FieldLabel>Dispute Window</FieldLabel>
            <FieldContent>
              <Select value={disputeWindowMin} onValueChange={setDisputeWindowMin}>
                <SelectTrigger className="w-full cursor-pointer">
                  <span className="text-gray-900 text-sm">
                    {parseInt(disputeWindowMin) >= 60
                      ? `${parseInt(disputeWindowMin) / 60}h`
                      : `${disputeWindowMin}m`}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 5, label: "5 minutes" },
                    { value: 10, label: "10 minutes" },
                    { value: 30, label: "30 minutes" },
                    { value: 60, label: "1 hour" },
                    { value: 360, label: "6 hours" },
                    { value: 1440, label: "24 hours" },
                  ].map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="font-mono text-[11px] text-gray-400 mt-1">
                Participants can dispute the result for{" "}
                {parseInt(disputeWindowMin) >= 60
                  ? `${parseInt(disputeWindowMin) / 60} hour${parseInt(disputeWindowMin) >= 120 ? "s" : ""}`
                  : `${disputeWindowMin} minutes`}{" "}
                after a result is proposed
              </p>
            </FieldContent>
          </Field>

          {error && <FieldError>{error}</FieldError>}
          {isConfirming && (
            <p className="font-mono text-xs text-mona-purple bg-mona-purple/5 border border-mona-purple/20 rounded-lg px-3 py-2">
              Transaction confirmed! Opening your pool…
            </p>
          )}

          <animated.button
            type="submit"
            disabled={isPending || isConfirming}
            style={{ scale: submitSpring }}
            className={`w-full font-mono text-xs uppercase tracking-wider py-3 rounded-lg transition-all ${
              isPending || isConfirming
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-mona-purple hover:bg-mona-purple/90 text-white cursor-pointer shadow-sm hover:shadow-md"
            }`}
          >
            {isConfirming ? "Opening Pool…" : isPending ? "Confirm in Wallet…" : "Create Pool"}
          </animated.button>
        </form>
      )}
    </div>
  );
}
