import { Link } from "react-router-dom";
import { motion } from "motion/react";

const STEPS = [
  { step: "1", title: "Create or Join", desc: "Set the stake, pick the match, and choose an outcome. Your stake goes into the contract — not a person's wallet." },
  { step: "2", title: "Watch the Match", desc: "After kickoff, the pool locks automatically. No more joins." },
  { step: "3", title: "Propose the Result", desc: "Only participants can propose the final result. The app prefills a suggested result, but you always confirm before submitting." },
  { step: "4", title: "Dispute if Needed", desc: "A dispute window opens. Participants can vote if they disagree with the proposed result." },
  { step: "5", title: "Finalize & Claim", desc: "After the window closes, anyone can finalize. Winners claim the pot. Ties or cancellations refund everyone." },
];

export default function HowItWorks() {
  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="font-mono text-xs text-gray-400 hover:text-mona-purple no-underline transition-colors mb-6 inline-block">
        ← Back
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-mona-ink mb-2">How It Works</h1>
        <p className="font-mono text-xs text-gray-500 mb-8">
          Trustless group betting on sports matches. Your stake goes into a smart contract on Monad — nobody can move it except by the rules written into the contract.
        </p>
      </motion.div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="space-y-6">
          {STEPS.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-mona-purple/10 border border-mona-purple/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="font-mono text-sm font-bold text-mona-purple">{item.step}</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-mona-ink">{item.title}</h3>
                <p className="font-mono text-sm text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security note */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h4 className="font-display font-bold text-mona-ink text-sm mb-2">Security</h4>
          <ul className="font-mono text-xs text-gray-500 space-y-1.5">
            <li>• No admin keys — the contract has no owner</li>
            <li>• No upgrade path — once deployed, the code is fixed</li>
            <li>• Reentrancy guard on all payout functions</li>
            <li>• Sports data is advisory only — the contract never trusts an external feed</li>
            <li>• Wallets managed by RainbowKit — key material never touches the app</li>
          </ul>
        </div>

        <p className="font-mono text-[10px] text-gray-400 text-center mt-6">
          Monad Testnet · Chain ID 10143
        </p>
      </div>
    </div>
  );
}
