const STORAGE_KEY = "knockout_pools_display_name";

export function getDisplayName(address) {
  // Check if this address has a saved name
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved || null;
}
