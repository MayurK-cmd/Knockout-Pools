// Grain gradient background for PoolDetail page.
// Inspired by 21st.dev / paper-design/grain-gradient.

export default function GrainGradient() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base dark */}
      <div className="absolute inset-0 bg-[#0e091c]" />

      {/* Grain texture via SVG filter */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" opacity="0.4" />
      </svg>

      {/* Subtle purple glow — center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.12] blur-[120px]"
        style={{ background: "radial-gradient(circle, #6e54ff 0%, transparent 70%)" }}
      />

      {/* Lavender accent — top right */}
      <div
        className="absolute -top-40 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.08] blur-[100px]"
        style={{ background: "radial-gradient(circle, #ddd7fe 0%, transparent 70%)" }}
      />

      {/* Cyan accent — bottom left */}
      <div
        className="absolute -bottom-40 -left-40 w-[350px] h-[350px] rounded-full opacity-[0.06] blur-[90px]"
        style={{ background: "radial-gradient(circle, #85e6ff 0%, transparent 70%)" }}
      />
    </div>
  );
}
