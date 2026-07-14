import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const STORAGE_KEY = "knockout_pools_display_name";

function NameForm({ onSave }) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(name); }} className="flex flex-col gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your display name…"
        maxLength={24}
        autoFocus
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-body text-sm text-mona-ink placeholder-gray-400 focus:outline-none focus:border-mona-purple"
      />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => onSave("")} className="font-mono text-xs text-gray-500 hover:text-mona-ink px-3 py-1.5 transition-colors">
          Skip
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="font-mono text-xs uppercase tracking-wider bg-mona-purple hover:bg-mona-purple/80 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export default function Navbar() {
  const location = useLocation();
  const { isConnected, address } = useAccount();
  const isLanding = location.pathname === "/" && !isConnected;
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(STORAGE_KEY) || "");

  // Prompt for name on first connect
  useEffect(() => {
    if (isConnected && !localStorage.getItem(STORAGE_KEY)) {
      setShowNamePrompt(true);
    }
  }, [isConnected]);

  const saveName = (name) => {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setDisplayName(trimmed);
    }
    setShowNamePrompt(false);
  };

  // When not on landing and gradient is showing, use dark text on light bg
  // When on landing, same. Only when NOT showing gradient (pool detail) use white text.
  const isOnGradientPage = isLanding || isConnected;

  return (
    <>
      <nav
        className={`flex items-center justify-between px-4 sm:px-8 py-3 border-b transition-colors ${
          isOnGradientPage ? "border-gray-200 bg-white/70 backdrop-blur-lg" : "border-white/10"
        }`}
      >
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className={`font-display text-lg sm:text-xl font-extrabold tracking-tight no-underline transition-colors ${
              isOnGradientPage ? "text-mona-ink hover:text-mona-purple" : "text-white hover:text-mona-purple"
            }`}
          >
            Knockout Pools
          </Link>

          {isConnected && (
            <div className="hidden sm:flex items-center gap-1">
              {[
                { to: "/pools", label: "Pools" },
                { to: "/create", label: "Create" },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`font-mono text-xs uppercase tracking-widest no-underline px-3 py-1.5 rounded-lg transition-colors ${
                    location.pathname === to
                      ? "bg-mona-purple/10 text-mona-purple"
                      : "text-gray-500 hover:text-mona-ink hover:bg-gray-100"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isConnected && displayName && (
            <span className="font-mono text-xs text-gray-500 hidden sm:block">
              {displayName}
            </span>
          )}
          <div>
            <ConnectButton
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </nav>

      {/* Name prompt modal */}
      <AnimatePresence>
        {showNamePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl"
            >
              <h2 className="font-display text-lg font-bold text-mona-ink mb-2">What should we call you?</h2>
              <p className="font-mono text-xs text-gray-500 mb-4">This is stored locally and only used for display.</p>
              <NameForm onSave={saveName} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
