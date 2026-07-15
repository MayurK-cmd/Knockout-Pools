import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { fetchLeaderboard } from "../lib/pools.js";
import { formatMon, shortenAddress } from "../lib/format.js";

const MEDAL_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="font-mono text-xs text-gray-400 hover:text-mona-purple no-underline transition-colors mb-6 inline-block">
        ← Back
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-mona-ink mb-2">Leaderboard</h1>
        <p className="font-mono text-xs text-gray-500 mb-8">
          Top earners across all pools.
        </p>
      </motion.div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-mona-purple border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && leaders.length === 0 && (
          <p className="font-mono text-xs text-gray-400 text-center py-10">No results yet. Be the first to win!</p>
        )}
        {!loading && leaders.length > 0 && (
          <div className="space-y-1">
            {leaders.map((entry, i) => (
              <div
                key={entry.address}
                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold font-mono"
                    style={{ backgroundColor: (MEDAL_COLORS[i] || "#f3f4f6") + "33", color: MEDAL_COLORS[i] || "#9ca3af" }}
                  >
                    {i + 1}
                  </span>
                  <div className="text-left">
                    <span className="font-mono text-sm text-gray-700">
                      {entry.displayName || shortenAddress(entry.address)}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 ml-2">
                      {entry.wins}W / {entry.losses}L
                    </span>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-mona-ink">
                  {formatMon(entry.earned)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
