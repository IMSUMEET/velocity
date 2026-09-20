"use client";

import { useMemo } from "react";
import { cityMapData } from "@velocity/engine";
import type { Driver, Incident } from "@velocity/engine";
import { useStore } from "@/lib/store";

const nodeIndex = new Map(cityMapData.nodes.map((n) => [n.id, n]));

function driverPos(d: Driver): { x: number; y: number } {
  const cur = nodeIndex.get(d.currentNodeId);
  if (d.route && d.route.length > d.routeIndex + 1) {
    const a = nodeIndex.get(d.route[d.routeIndex]);
    const b = nodeIndex.get(d.route[d.routeIndex + 1]);
    if (a && b) return { x: a.x + (b.x - a.x) * d.progress, y: a.y + (b.y - a.y) * d.progress };
  }
  return { x: cur?.x ?? 0, y: cur?.y ?? 0 };
}

const statusFill: Record<string, string> = {
  IDLE: "#64748b", EN_ROUTE_PICKUP: "#38bdf8", WAITING_AT_RESTAURANT: "#fbbf24",
  DELIVERING: "#a78bfa", ON_BREAK: "#f472b6", OFFLINE: "#475569",
};

export default function CityMap() {
  const drivers = useStore((s) => s.snapshot?.drivers) ?? [];
  const incidents = useStore((s) => s.snapshot?.incidents) ?? [];
  const orders = useStore((s) => s.snapshot?.orders) ?? [];

  const affectedEdges = useMemo(
    () => new Set(incidents.map((i: Incident) => i.affectedEdgeId).filter(Boolean) as string[]),
    [incidents]
  );
  const activeRestaurants = useMemo(
    () => new Set(orders.filter((o) => o.status !== "DELIVERED").map((o) => o.restaurantNodeId)),
    [orders]
  );

  return (
    <div className="glass overflow-hidden p-2">
      <svg viewBox="120 70 880 690" className="h-[560px] w-full">
        {/* zones */}
        {cityMapData.zones.map((z) => (
          <g key={z.id}>
            <circle cx={z.centerX} cy={z.centerY} r={z.radius} fill={z.color} opacity={0.06} />
            <text x={z.labelX} y={z.labelY} fill={z.color} opacity={0.5} fontSize={13} fontWeight={600} textAnchor="middle">
              {z.name}
            </text>
          </g>
        ))}

        {/* edges */}
        {cityMapData.edges.map((e) => {
          const a = nodeIndex.get(e.from), b = nodeIndex.get(e.to);
          if (!a || !b) return null;
          const hit = affectedEdges.has(e.id);
          return (
            <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={hit ? "#f87171" : "#1e293b"} strokeWidth={hit ? 4 : e.isMajor ? 3 : 1.5}
              strokeLinecap="round" opacity={hit ? 0.9 : 0.7} />
          );
        })}

        {/* buildings */}
        {cityMapData.buildings.map((b) => {
          const isRestaurant = b.type === "restaurant";
          const active = activeRestaurants.has(b.nodeId);
          return (
            <g key={b.id}>
              {isRestaurant && active && (
                <circle cx={b.x} cy={b.y} r={11} fill="none" stroke="#38bdf8" strokeWidth={1.5} opacity={0.6}>
                  <animate attributeName="r" values="8;15;8" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <text x={b.x} y={b.y + 4} fontSize={isRestaurant ? 13 : 10} textAnchor="middle" opacity={isRestaurant ? 1 : 0.5}>
                {b.icon}
              </text>
            </g>
          );
        })}

        {/* drivers */}
        {drivers.map((d) => {
          const p = driverPos(d);
          const fill = statusFill[d.status] ?? "#64748b";
          const car = d.vehicleType === "CAR";
          return (
            <g key={d.id} transform={`translate(${p.x} ${p.y})`}>
              {(d.status === "DELIVERING" || d.status === "EN_ROUTE_PICKUP") && (
                <circle r={9} fill={fill} opacity={0.25}>
                  <animate attributeName="r" values="6;12;6" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              {car
                ? <rect x={-4} y={-4} width={8} height={8} rx={2} fill={fill} stroke="#0a0f1f" strokeWidth={1} />
                : <circle r={4.5} fill={fill} stroke="#0a0f1f" strokeWidth={1} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
