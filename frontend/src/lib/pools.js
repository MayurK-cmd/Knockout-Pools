import { monadTestnet } from "../lib/chain.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export async function fetchPools(status) {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`${BACKEND_URL}/api/pools${params}`);
  if (!res.ok) throw new Error("Failed to fetch pools");
  return res.json();
}

export async function fetchPool(id) {
  const res = await fetch(`${BACKEND_URL}/api/pools/${id}`);
  if (!res.ok) throw new Error("Pool not found");
  return res.json();
}

export async function fetchPoolParticipants(id) {
  const res = await fetch(`${BACKEND_URL}/api/pools/${id}/participants`);
  if (!res.ok) throw new Error("Failed to fetch participants");
  return res.json();
}

export async function saveName(address, name) {
  const res = await fetch(`${BACKEND_URL}/api/name`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, name }),
  });
  return res.ok;
}

export async function fetchNames(addresses) {
  const res = await fetch(`${BACKEND_URL}/api/names`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  if (!res.ok) return {};
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${BACKEND_URL}/api/leaderboard`);
  if (!res.ok) return [];
  return res.json();
}

// ── Contract ABI & address ──
import contractArtifact from "../contract/KnockoutPool.json";

export const CONTRACT_ADDRESS = contractArtifact.address;
export const CONTRACT_ABI = contractArtifact.abi;
export const CHAIN = monadTestnet;
