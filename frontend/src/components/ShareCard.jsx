import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import gsap from "gsap";
import { shortenAddress, formatMon } from "../lib/format.js";
import { CONTRACT_ADDRESS } from "../lib/pools.js";

export default function ShareCard({ pool, address }) {
  const cardRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const userParticipant = address
    ? pool.participants?.find((p) => p.address?.toLowerCase() === address.toLowerCase())
    : null;
  const isWinner = userParticipant && pool.finalResult !== null && userParticipant.pick === pool.finalResult;
  const isLoser = userParticipant && pool.finalResult !== null && userParticipant.pick !== pool.finalResult;

  const pot = pool.stakeAmount && pool.participantCount
    ? formatMon(BigInt(pool.stakeAmount) * BigInt(pool.participantCount))
    : "—";
  const stake = pool.stakeAmount ? formatMon(pool.stakeAmount) : "—";
  const winnerLabel = pool.outcomeLabels?.[pool.finalResult] ?? `Pick ${pool.finalResult + 1}`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      // Animate in before capture
      gsap.fromTo(cardRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.2 });
      await new Promise((r) => setTimeout(r, 250));

      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 });

      // Download
      const link = document.createElement("a");
      link.download = `knockout-pool-${pool.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("share card generation failed:", err);
    }
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      gsap.fromTo(cardRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.2 });
      await new Promise((r) => setTimeout(r, 250));

      const blob = await (await fetch(
        await toPng(cardRef.current, { quality: 1, pixelRatio: 2 })
      )).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch {
      // Fallback to download if clipboard fails
      handleDownload();
    }
    setGenerating(false);
  };

  const shareText = encodeURIComponent(
    `I ${isWinner ? "won" : isLoser ? "lost" : "checked out"} "${pool.matchName}" on Knockout Pools! Final: ${winnerLabel} | Pot: ${pot} 🏆`
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {/* Hidden render target */}
      <div className="fixed -left-[9999px] top-0" aria-hidden="true">
        <div
          ref={cardRef}
          className="w-[420px] bg-[#0e091c] text-white p-6 rounded-2xl font-sans"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          {/* Brand header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-mona-purple/20 flex items-center justify-center">
                <span className="font-display text-sm font-black text-[#6E54FF]" style={{ fontFamily: "Nunito, Britti Sans, system-ui, sans-serif" }}>
                  KP
                </span>
              </div>
              <span className="font-mono text-[11px] text-white/50 uppercase tracking-wider" style={{ fontFamily: "Roboto Mono, monospace" }}>
                Knockout Pools
              </span>
            </div>
            <span className="font-mono text-[10px] text-white/30" style={{ fontFamily: "Roboto Mono, monospace" }}>
              MONAD
            </span>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mb-5" />

          {/* Match */}
          <h2 className="font-display text-lg font-bold text-white mb-1" style={{ fontFamily: "Nunito, Britti Sans, system-ui, sans-serif" }}>
            {pool.matchName}
          </h2>

          {/* Result tag */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#6E54FF] font-mono text-[11px] uppercase tracking-wider" style={{ fontFamily: "Roboto Mono, monospace" }}>
              Final Result
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#6E54FF]/20 text-[#6E54FF]" style={{ fontFamily: "Roboto Mono, monospace" }}>
              {winnerLabel}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="font-mono text-[9px] text-white/40 uppercase tracking-wider mb-0.5" style={{ fontFamily: "Roboto Mono, monospace" }}>Total Pot</p>
              <p className="font-mono text-sm font-semibold text-white" style={{ fontFamily: "Roboto Mono, monospace" }}>{pot}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="font-mono text-[9px] text-white/40 uppercase tracking-wider mb-0.5" style={{ fontFamily: "Roboto Mono, monospace" }}>Stake</p>
              <p className="font-mono text-sm font-semibold text-white" style={{ fontFamily: "Roboto Mono, monospace" }}>{stake}</p>
            </div>
          </div>

          {/* Outcome */}
          <div className="bg-white/5 rounded-lg p-3 mb-4">
            {isWinner ? (
              <p className="font-mono text-sm text-green-400 text-center" style={{ fontFamily: "Roboto Mono, monospace" }}>
                You won! 🎉
              </p>
            ) : isLoser ? (
              <p className="font-mono text-sm text-red-400 text-center" style={{ fontFamily: "Roboto Mono, monospace" }}>
                Better luck next time
              </p>
            ) : (
              <p className="font-mono text-xs text-white/50 text-center" style={{ fontFamily: "Roboto Mono, monospace" }}>
                Pool settled: {winnerLabel}
              </p>
            )}
          </div>

          {/* Verify on-chain */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <span className="font-mono text-[9px] text-white/30" style={{ fontFamily: "Roboto Mono, monospace" }}>
              Pool #{pool.id}
            </span>
            <span className="font-mono text-[9px] text-white/30" style={{ fontFamily: "Roboto Mono, monospace" }}>
              {shortenAddress(CONTRACT_ADDRESS)}
            </span>
          </div>

          {/* Grain texture overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" style={{ borderRadius: "inherit" }}>
            <filter id="share-card-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#share-card-grain)" />
          </svg>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <button
          onClick={handleDownload}
          disabled={generating}
          className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg bg-[#6E54FF] hover:bg-[#6E54FF]/80 text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          {generating ? "Generating…" : "Download Image"}
        </button>
        <button
          onClick={handleCopy}
          disabled={generating}
          className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-mona-ink transition-all disabled:opacity-50 cursor-pointer"
        >
          Copy Image
        </button>
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-mona-ink no-underline transition-all"
        >
          Share on X
        </a>
      </div>
    </div>
  );
}
