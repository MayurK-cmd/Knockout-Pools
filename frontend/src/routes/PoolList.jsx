import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import { fetchPools } from "../lib/pools.js";
import { formatMon, formatTimeLeft, statusLabel, statusColor } from "../lib/format.js";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select.jsx";

const SPORTS = ["Football", "Cricket", "Formula 1", "Basketball", "Tennis"];
const STATUSES = ["Open", "Locked", "Dispute Window", "Finalized", "Cancelled"];
const SPORT_KEYWORDS = {
  football: ["football", "soccer", "epl", "champions league", "premier league", "la liga", "serie a", "bundesliga"],
  cricket: ["cricket", "test match", "odi", "t20", "ipl", "ashes"],
  "formula 1": ["formula 1", "f1", "grand prix", "gp"],
  basketball: ["basketball", "nba", "euroleague"],
  tennis: ["tennis", "grand slam", "wimbledon", "us open", "australian open", "french open", "atp", "wta"],
};

function guessSport(matchName) {
  if (!matchName) return "Football";
  const lower = matchName.toLowerCase();
  for (const [sport, keywords] of Object.entries(SPORT_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return sport;
  }
  return "Football";
}

const sportImage = {
  Football: "/images/football.avif",
  Cricket: "/images/cricket.avif",
  "Formula 1": "/images/f1.jpg",
  Basketball: "/images/basketball.jpg",
  Tennis: "/images/tennis.avif",
};

const sportColor = {
  Football: "#85e6ff",
  Cricket: "#b9e3f9",
  "Formula 1": "#ff8ee4",
  Basketball: "#ffae45",
  Tennis: "#ddd7fe",
};

function PoolCard({ pool }) {
  const cardRef = useRef(null);
  const imgRef = useRef(null);
  const sport = guessSport(pool.matchName);
  const deadline = formatTimeLeft(pool.joinDeadline);
  const pot = pool.stakeAmount && pool.participantCount
    ? formatMon(BigInt(pool.stakeAmount) * BigInt(pool.participantCount))
    : "—";
  const stake = pool.stakeAmount ? formatMon(pool.stakeAmount) : "—";
  const imgSrc = sportImage[sport];

  useEffect(() => {
    if (pool.status === "locked" || pool.status === "dispute_window") {
      gsap.fromTo(cardRef.current,
        { boxShadow: "0 0 0 rgba(110, 84, 255, 0)" },
        {
          boxShadow: "0 0 24px rgba(110, 84, 255, 0.15)",
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        }
      );
    }
  }, [pool.status]);

  return (
    <Link to={`/pool/${pool.id}`} className="no-underline block">
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-mona-purple/40 hover:shadow-lg transition-all cursor-pointer group"
      >
        {/* Sport image */}
        <div className="relative h-36 sm:h-40 bg-gray-100 overflow-hidden">
          <img
            ref={imgRef}
            src={imgSrc}
            alt={sport}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.style.backgroundColor = `${sportColor[sport]}15`;
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {/* Status badge */}
          <span
            className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-semibold shadow-sm"
            style={{ backgroundColor: statusColor(pool.status), color: "#fff" }}
          >
            {statusLabel(pool.status)}
          </span>
          {/* Sport tag */}
          <span
            className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full font-semibold bg-white/90 backdrop-blur-sm shadow-sm"
            style={{ color: sportColor[sport] }}
          >
            {sport}
          </span>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-display font-bold text-mona-ink leading-tight line-clamp-1 mb-3">{pool.matchName}</h3>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Stake</p>
              <p className="font-mono text-xs font-semibold text-mona-ink">{stake}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Pot</p>
              <p className="font-mono text-xs font-semibold text-mona-ink">{pot}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">{deadline === "Ended" ? "Started" : "Closes"}</p>
              <p className="font-mono text-xs font-semibold text-mona-ink">{deadline}</p>
            </div>
          </div>

          {/* Participants bar */}
          {pool.participantCount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {Array.from({ length: Math.min(pool.participantCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border-2 border-white"
                      style={{ backgroundColor: [ "#6e54ff", "#85e6ff", "#ff8ee4", "#ffae45"][i] }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-gray-500">
                  {pool.participantCount} participant{pool.participantCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

export default function PoolList() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPools()
      .then((data) => { if (!cancelled) { setPools(data); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (search.length < 1) { setSearchSuggestions([]); return; }
    const lower = search.toLowerCase();
    const suggestions = pools
      .filter((p) => p.matchName?.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((p) => p.matchName);
    setSearchSuggestions([...new Set(suggestions)]);
  }, [search, pools]);

  const filtered = pools.filter((p) => {
    if (sportFilter !== "All" && guessSport(p.matchName).toLowerCase() !== sportFilter.toLowerCase()) return false;
    if (statusFilter !== "All") {
      const canonical = statusFilter.toLowerCase().replace(/\s+/g, "_");
      if (p.status !== canonical && !(canonical === "dispute_window" && p.status === "dispute_window")) return false;
    }
    if (search && !p.matchName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold text-mona-ink mb-6">Pools</h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative w-full sm:w-64" ref={searchRef}>
          <input
            type="text"
            placeholder="Search matches…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 font-body text-sm text-mona-ink placeholder-gray-400 focus:outline-none focus:border-mona-purple focus:ring-1 focus:ring-mona-purple/20 transition-shadow"
          />
          <AnimatePresence>
            {showSuggestions && searchSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden"
              >
                {searchSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => { setSearch(s); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 font-body text-sm text-gray-600 hover:bg-gray-50 hover:text-mona-ink transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="cursor-pointer w-36">
            <span className="text-gray-900 text-sm">{sportFilter === "All" ? "All Sports" : sportFilter}</span>
          </SelectTrigger>
          <SelectContent>
            {["All", ...SPORTS].map((s) => (
              <SelectItem key={s} value={s}>{s === "All" ? "All Sports" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="cursor-pointer w-40">
            <span className="text-gray-900 text-sm">{statusFilter === "All" ? "All Statuses" : statusFilter}</span>
          </SelectTrigger>
          <SelectContent>
            {["All", ...STATUSES].map((s) => (
              <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-mona-purple border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-center py-20">
          <p className="text-red-500 font-mono text-sm">Failed to load pools</p>
          <p className="text-gray-400 font-mono text-xs mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 font-mono text-xs uppercase tracking-wider bg-mona-purple hover:bg-mona-purple/80 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 font-mono text-sm">No pools found</p>
          <p className="text-gray-400 font-mono text-xs mt-1">
            {pools.length === 0 ? "No pools have been created yet. Be the first!" : "Try changing your filters."}
          </p>
          {pools.length === 0 && (
            <Link
              to="/create"
              className="inline-block mt-6 font-mono text-xs uppercase tracking-wider bg-mona-purple hover:bg-mona-purple/80 text-white px-6 py-3 rounded-lg transition-colors no-underline cursor-pointer"
            >
              Create a Pool
            </Link>
          )}
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
