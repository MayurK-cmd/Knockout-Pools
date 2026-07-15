import { useEffect, useRef } from "react";
import gsap from "gsap";

// A small self-contained decorative square with grain texture + glow.
// Works inside any container (not fullscreen).
let uid = 0;

export default function GrainSquare({ className = "w-32 h-32" }) {
  const squareRef = useRef(null);
  const id = useRef(`grain-${++uid}`);

  useEffect(() => {
    if (!squareRef.current) return;
    gsap.fromTo(
      squareRef.current,
      { opacity: 0.2, scale: 0.9 },
      {
        opacity: 0.5,
        scale: 1.05,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      }
    );
  }, []);

  return (
    <div ref={squareRef} className={`relative ${className} rounded-xl overflow-hidden`}>
      {/* Base dark */}
      <div className="absolute inset-0 bg-[#0e091c]" />

      {/* Grain texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]">
        <filter id={id.current}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id.current})`} opacity="0.5" />
      </svg>

      {/* Purple glow */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{ background: "radial-gradient(circle at 40% 40%, #6e54ff 0%, transparent 70%)" }}
      />

      {/* Lavender accent */}
      <div
        className="absolute -top-4 -right-4 w-1/2 h-1/2 rounded-full opacity-[0.1] blur-[20px]"
        style={{ background: "radial-gradient(circle, #ddd7fe 0%, transparent 70%)" }}
      />
    </div>
  );
}
