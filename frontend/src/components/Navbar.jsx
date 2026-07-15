import { Link, useLocation, useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { saveName } from "../lib/pools.js";
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
  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  const { data: balance } = useBalance({ address, watch: true });
  const isLanding = location.pathname === "/" && !isConnected;
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(STORAGE_KEY) || "");

  useEffect(() => {
    if (isConnected && !localStorage.getItem(STORAGE_KEY)) {
      setShowNamePrompt(true);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected && !isLanding) {
      navigate("/", { replace: true });
    }
  }, [isConnected, isLanding, navigate]);

  const saveDisplayName = (name) => {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setDisplayName(trimmed);
      // Sync to backend so other participants can see it
      if (address) saveName(address, trimmed).catch(() => {});
    }
    setShowNamePrompt(false);
  };

  const openNameEdit = () => {
    setShowNamePrompt(true);
  };

  const isOnGradientPage = isLanding || isConnected;

  const [showBalanceDropdown, setShowBalanceDropdown] = useState(false);

  const navLinkClass = (path) =>
    location.pathname === path
      ? "text-mona-purple font-semibold"
      : "text-gray-500 hover:text-mona-ink";

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
            <div className="hidden sm:flex items-center gap-1 relative">
              {[
                { to: "/pools", label: "Pools" },
                { to: "/create", label: "Create" },
                { to: "/how-it-works", label: "How It Works" },
                { to: "/leaderboard", label: "Leaderboard" },
              ].map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`font-mono text-xs uppercase tracking-widest no-underline px-3 py-1.5 rounded-lg transition-colors nav-glow ${navLinkClass(to)}`}
                >
                  {label}
                </Link>
              ))}
              <a
                href="https://testnet.monadvision.com/address/0x2098FA95aEcf046790056ad19C2a1AE569e52c46"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs uppercase tracking-widest no-underline px-3 py-1.5 rounded-lg transition-colors text-gray-500 nav-glow inline-flex items-center gap-1"
              >
                View on Chain
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <>
              {balance && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setShowBalanceDropdown(!showBalanceDropdown)}
                    onBlur={() => setTimeout(() => setShowBalanceDropdown(false), 200)}
                    className="font-mono text-xs text-gray-500 nav-glow cursor-pointer px-2 py-1 rounded-lg"
                  >
                    {Number(balance.formatted).toFixed(4)} MON
                  </button>
                  <AnimatePresence>
                    {showBalanceDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden"
                      >
                        <a
                          href={`https://testnet.monadvision.com/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-3 py-2 font-mono text-xs text-gray-600 hover:bg-gray-50 hover:text-mona-ink no-underline transition-colors"
                        >
                          View Wallet
                        </a>
                        <a
                          href="https://faucet.monad.xyz/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full text-left px-3 py-2 font-mono text-xs text-gray-600 hover:bg-gray-50 hover:text-mona-ink no-underline transition-colors"
                        >
                          Testnet Faucet
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {displayName && (
                <button
                  onClick={openNameEdit}
                  className="font-mono text-xs text-gray-500 hover:text-mona-ink hidden sm:flex items-center gap-1 cursor-pointer nav-glow px-2 py-0.5 rounded-lg transition-colors"
                >
                  {displayName}
                  <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </>
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
              <NameForm onSave={saveDisplayName} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
