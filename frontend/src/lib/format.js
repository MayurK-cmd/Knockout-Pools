// Format utilities

export function formatMon(wei) {
  if (!wei) return "0 MON";
  const val = typeof wei === "bigint" ? wei : BigInt(wei);
  const mon = Number(val) / 1e18;
  if (mon >= 1000) return `${(mon / 1000).toFixed(1)}k MON`;
  if (mon >= 1) return `${mon.toFixed(2)} MON`;
  return `${(mon * 1000).toFixed(0)} mMON`;
}

export function formatTimeLeft(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(timestamp) - now;
  if (diff <= 0) return "Ended";
  const mins = Math.floor(diff / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function statusLabel(status) {
  const labels = {
    open: "Open",
    locked: "Locked",
    dispute_window: "Dispute Window",
    finalized: "Finalized",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

export function statusColor(status) {
  const colors = {
    open: "var(--color-mona-cyan)",
    locked: "var(--color-mona-purple)",
    dispute_window: "var(--color-mona-orange)",
    finalized: "#22c55e",
    cancelled: "#ef4444",
  };
  return colors[status] || "#888";
}
