import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Navigate, Link } from "react-router-dom";
import BgGradient from "../components/BgGradient.jsx";
import { fetchLeaderboard } from "../lib/pools.js";
import { formatMon, shortenAddress } from "../lib/format.js";
import { CONTRACT_ADDRESS } from "../lib/pools.js";

const MEDAL_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];

function LeaderboardPreview() {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    fetchLeaderboard().then(setLeaders).catch(() => {});
  }, []);

  if (leaders.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm w-full mt-8">
      <h3 className="font-display font-bold text-mona-ink text-center mb-4">🏆 Leaderboard</h3>
      <div className="space-y-2">
        {leaders.slice(0, 3).map((entry, i) => (
          <div
            key={entry.address}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono" style={{ backgroundColor: MEDAL_COLORS[i] + "33", color: MEDAL_COLORS[i] }}>
                {i + 1}
              </span>
              <span className="font-mono text-xs text-gray-700">
                {entry.displayName || shortenAddress(entry.address)}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold text-mona-ink">
              {formatMon(entry.earned)}
            </span>
          </div>
        ))}
      </div>
      {leaders.length > 3 && (
        <p className="font-mono text-[10px] text-gray-400 text-center mt-3">
          +{leaders.length - 3} more
        </p>
      )}
    </div>
  );
}

export default function Landing() {
  const { isConnected } = useAccount();

  if (isConnected) return <Navigate to="/pools" replace />;

  return (
    <>
      <BgGradient />
      <div className="flex flex-col items-center min-h-[70vh] text-center max-w-2xl mx-auto relative pt-10 sm:pt-16 pb-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-mona-ink leading-tight mb-3">
            Knockout Pools
          </h1>
          <p className="font-body text-lg text-gray-500 mb-1 max-w-lg mx-auto">
            Trustless group betting on sports matches.
          </p>
          <p className="font-mono text-sm text-gray-400 mb-8 max-w-md mx-auto">
            Built on <span className="text-mona-purple font-semibold">Monad</span> — your stake goes into a smart contract, not a person's wallet.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mb-10 [&_button]:!bg-mona-purple [&_button]:!text-white [&_button]:!shadow-lg [&_button:hover]:!shadow-xl [&_button]:!transition-shadow"
        >
          <ConnectButton />
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="w-full flex justify-center gap-6 sm:gap-10 mb-10"
        >
          {[
            { label: "Chain", value: "Monad" },
            { label: "Speed", value: "10k TPS" },
            { label: "Finality", value: "~1s" },
            { label: "Contract", value: "Verified" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-xs font-bold text-mona-ink">{stat.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="w-full"
        >
          <h3 className="font-display text-sm font-bold text-mona-ink mb-4 tracking-wide uppercase">How It Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            {[
              { step: "1", title: "Create or Join", desc: "Set the stake, pick the match, and choose an outcome. Your MON stays in the contract." },
              { step: "2", title: "Watch the Match", desc: "After kickoff, the pool locks automatically. Nobody can join or change picks." },
              { step: "3", title: "Win or Refund", desc: "Winners claim the pot. Ties and cancellations refund everyone. Always." },
            ].map((item, i) => (
              <div
                key={item.step}
                className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-all"
              >
                <span className="font-mono text-[10px] text-mona-purple uppercase tracking-wider font-semibold">
                  Step {item.step}
                </span>
                <h4 className="font-display font-bold text-mona-ink mt-1 mb-1 text-sm">{item.title}</h4>
                <p className="font-mono text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="w-full"
        >
          <LeaderboardPreview />
        </motion.div>

        {/* Monad info card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="w-full mt-8 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm"
        >
          <h3 className="font-display font-bold text-mona-ink text-center mb-3">Built on Monad</h3>
          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-1">EVM Compatible</p>
              <p className="font-body text-xs text-gray-600">Deploy existing Solidity contracts with zero changes. Full Ethereum RPC compatibility.</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-1">Parallel Execution</p>
              <p className="font-body text-xs text-gray-600">Transactions process concurrently with 10,000 TPS at 400ms block times.</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-1">Open Source</p>
              <p className="font-body text-xs text-gray-600">Consensus and execution clients are open source under GPL-3.0, built by Category Labs.</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-1">Permissionless</p>
              <p className="font-body text-xs text-gray-600">No admin keys, no upgrade authority, no trusted setup. The contract is the sole rulebook.</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200 flex justify-center gap-4">
            <a href="https://www.monad.xyz" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-mona-purple hover:text-mona-purple/80 uppercase tracking-wider no-underline">
              Monad Website →
            </a>
            <a href={`https://testnet.monadvision.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-mona-purple hover:text-mona-purple/80 uppercase tracking-wider no-underline">
              View Contract →
            </a>
            <a href="https://faucet.monad.xyz" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-mona-purple hover:text-mona-purple/80 uppercase tracking-wider no-underline">
              Get MON →
            </a>
          </div>
        </motion.div>

        {/* Key principles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="w-full mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { icon: "🔒", label: "Non-Custodial" },
            { icon: "📜", label: "On-Chain Rules" },
            { icon: "👥", label: "Permissionless" },
            { icon: "🛡️", label: "Reentrancy Guard" },
          ].map((item) => (
            <div key={item.label} className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-lg">{item.icon}</p>
              <p className="font-mono text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
          className="font-mono text-[10px] text-gray-300 mt-10"
        >
          Monad Testnet · Chain ID 10143 · Built for BuildAnything Spark
        </motion.p>
      </div>
    </>
  );
}
