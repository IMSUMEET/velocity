import type { DispatchStrategy } from "@velocity/engine";

export const strategyColor: Record<DispatchStrategy, string> = {
  FASTEST_ETA: "#0284c7",
  LOWEST_COST: "#0891b2",
  BALANCED: "#64748b",
  BATCH_NEARBY: "#7c3aed",
  BATCH_OPTIMAL: "#9333ea",
};

export const isBatch = (s: DispatchStrategy) => s.startsWith("BATCH");

export const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const healthColor: Record<string, string> = {
  stable: "#059669", healthy: "#059669", busy: "#d97706", critical: "#dc2626",
};

export const moodColor: Record<string, string> = {
  HAPPY: "#059669", WAITING: "#0284c7", FRUSTRATED: "#d97706", ANGRY: "#dc2626",
};

// driver status → ring color on the map
export const statusColor: Record<string, string> = {
  IDLE: "#94a3b8", EN_ROUTE_PICKUP: "#2563eb", WAITING_AT_RESTAURANT: "#d97706",
  DELIVERING: "#7c3aed", ON_BREAK: "#db2777", OFFLINE: "#cbd5e1",
};

export const statusLabel: Record<string, string> = {
  IDLE: "Idle", EN_ROUTE_PICKUP: "To pickup", WAITING_AT_RESTAURANT: "At kitchen",
  DELIVERING: "Delivering", ON_BREAK: "On break", OFFLINE: "Offline",
  CREATED: "New", FINDING_DRIVER: "Matching", WAITING_FOR_FOOD: "Cooking",
  EN_ROUTE_DELIVERY: "En route", DELIVERED: "Delivered",
};

// building type → emoji fallback (city-map provides icons, but keep a map)
export const zoneTextColor = (hex: string) => hex;
