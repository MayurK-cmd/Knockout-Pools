import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Navigate } from "react-router-dom";
import BgGradient from "../components/BgGradient.jsx";

export default function Landing() {
  const { isConnected } = useAccount();

  if (isConnected) return <Navigate to="/pools" replace />;

  return (
    <>
      <BgGradient />
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-2xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo mark */}
          

          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-mona-ink leading-tight mb-4">
            Knockout Pools
          </h1>
          <p className="font-body text-lg text-gray-500 mb-2 max-w-lg mx-auto">
            Trustless group betting on sports matches.
          </p>
          <p className="font-mono text-sm text-gray-400 mb-10 max-w-md mx-auto">
            Your stake goes into a smart contract on Monad — not a person's wallet.
            No admin, no custodian, no one to trust.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mb-12 [&_button]:!bg-mona-purple [&_button]:!text-white [&_button]:!shadow-lg [&_button:hover]:!shadow-xl [&_button]:!transition-shadow"
        >
          <ConnectButton />
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full"
        >
          {[
            { step: "1", title: "Create or Join", desc: "Set the stake, pick the match, and choose an outcome." },
            { step: "2", title: "Watch the Match", desc: "After kickoff, the pool locks automatically." },
            { step: "3", title: "Win or Refund", desc: "Winners claim the pot. Ties and cancellations refund everyone." },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-left shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="font-mono text-[10px] text-mona-purple uppercase tracking-wider font-semibold">
                Step {item.step}
              </span>
              <h3 className="font-display font-bold text-mona-ink mt-1 mb-1">{item.title}</h3>
              <p className="font-mono text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Chain info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="font-mono text-[10px] text-gray-300 uppercase tracking-wider mt-8"
        >
          Monad Testnet · Chain ID 10143
        </motion.p>
      </div>
    </>
  );
}
