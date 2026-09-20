import type { DispatchStrategy } from "@velocity/engine";

export const strategyColor: Record<DispatchStrategy, string> = {
  FASTEST_ETA: "#38bdf8",
  LOWEST_COST: "#22d3ee",
  BALANCED: "#94a3b8",
  BATCH_NEARBY: "#a78bfa",
  BATCH_OPTIMAL: "#c084fc",
};

export const isBatch = (s: DispatchStrategy) => s.startsWith("BATCH");

export const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const healthColor: Record<string, string> = {
  stable: "#34d399", healthy: "#34d399", busy: "#fbbf24", critical: "#f87171",
};

export const moodColor: Record<string, string> = {
  HAPPY: "#34d399", WAITING: "#38bdf8", FRUSTRATED: "#fbbf24", ANGRY: "#f87171",
};

export const statusLabel: Record<string, string> = {
  IDLE: "Idle", EN_ROUTE_PICKUP: "To pickup", WAITING_AT_RESTAURANT: "At kitchen",
  DELIVERING: "Delivering", ON_BREAK: "On break", OFFLINE: "Offline",
  CREATED: "New", FINDING_DRIVER: "Matching", WAITING_FOR_FOOD: "Cooking",
  EN_ROUTE_DELIVERY: "En route", DELIVERED: "Delivered",
};
