// Gradient background component for the landing page.
// Inspired by 21st.dev / reuno-ui/bg-gredient — a soft ambient gradient
// that creates depth without distracting from content.

export default function BgGradient() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-white" />

      {/* Soft lavender glow — top left */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, #ddd7fe 0%, transparent 70%)" }}
      />

      {/* Purple glow — bottom right */}
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-30 blur-[100px]"
        style={{ background: "radial-gradient(circle, #6e54ff 0%, transparent 70%)" }}
      />

      {/* Subtle cyan accent — center right */}
      <div
        className="absolute top-1/3 -right-20 w-[300px] h-[300px] rounded-full opacity-20 blur-[80px]"
        style={{ background: "radial-gradient(circle, #85e6ff 0%, transparent 70%)" }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#6e54ff 1px, transparent 1px), linear-gradient(90deg, #6e54ff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
