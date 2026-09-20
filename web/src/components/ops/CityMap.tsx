"use client";

import { useMemo } from "react";
import { cityMapData } from "@velocity/engine";
import type { Driver } from "@velocity/engine";
import { useStore } from "@/lib/store";
import { statusColor } from "@/lib/ui";

const nodeIndex = new Map(cityMapData.nodes.map((n) => [n.id, n]));

// viewBox computed from node bounds (+ padding) so the whole city always fits.
const xs = cityMapData.nodes.map((n) => n.x);
const ys = cityMapData.nodes.map((n) => n.y);
const PAD = 58;
const VB = {
  x: Math.min(...xs) - PAD,
  y: Math.min(...ys) - PAD,
  w: Math.max(...xs) - Math.min(...xs) + PAD * 2,
  h: Math.max(...ys) - Math.min(...ys) + PAD * 2,
};

function driverPos(d: Driver) {
  if (d.route && d.route.length > d.routeIndex + 1) {
    const a = nodeIndex.get(d.route[d.routeIndex]);
    const b = nodeIndex.get(d.route[d.routeIndex + 1]);
    if (a && b) return { x: a.x + (b.x - a.x) * d.progress, y: a.y + (b.y - a.y) * d.progress };
  }
  const cur = nodeIndex.get(d.currentNodeId);
  return { x: cur?.x ?? 0, y: cur?.y ?? 0 };
}

function routePoints(route: string[]) {
  return route.map((id) => nodeIndex.get(id)).filter(Boolean).map((n) => `${n!.x},${n!.y}`).join(" ");
}

export default function CityMap() {
  const drivers = useStore((s) => s.snapshot?.drivers) ?? [];
  const incidents = useStore((s) => s.snapshot?.incidents) ?? [];
  const orders = useStore((s) => s.snapshot?.orders) ?? [];

  const affectedEdges = useMemo(
    () => new Set(incidents.map((i) => i.affectedEdgeId).filter(Boolean) as string[]),
    [incidents]
  );
  const activeRestaurants = useMemo(
    () => new Set(orders.filter((o) => o.status !== "DELIVERED").map((o) => o.restaurantNodeId)),
    [orders]
  );
  const activeDrivers = drivers.filter(
    (d) => (d.status === "EN_ROUTE_PICKUP" || d.status === "DELIVERING") && d.route.length > 1
  );

  return (
    <div className="card overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse2" /> Live city</span>
        <span className="chip">63 nodes · 93 roads · 6 zones</span>
      </div>
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet"
        className="w-full" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
        <defs>
          <filter id="chipShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#1b2238" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* zones */}
        {cityMapData.zones.map((z) => (
          <g key={z.id}>
            <circle cx={z.centerX} cy={z.centerY} r={z.radius} fill={z.color} opacity={0.1} />
            <text x={z.labelX} y={z.labelY} fill={z.color} fontSize={13} fontWeight={700}
              textAnchor="middle" opacity={0.65} style={{ letterSpacing: "0.06em" }}>
              {z.name.toUpperCase()}
            </text>
          </g>
        ))}

        {/* roads */}
        {cityMapData.edges.map((e) => {
          const a = nodeIndex.get(e.from), b = nodeIndex.get(e.to);
          if (!a || !b) return null;
          const hit = affectedEdges.has(e.id);
          return (
            <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={hit ? "#fca5a5" : "#d3dae7"} strokeWidth={hit ? 6 : e.isMajor ? 6 : 3.5}
              strokeLinecap="round" />
          );
        })}

        {/* active driver routes */}
        {activeDrivers.map((d) => (
          <polyline key={`r-${d.id}`} points={routePoints(d.route.slice(d.routeIndex))}
            fill="none" stroke={statusColor[d.status]} strokeWidth={3} strokeLinecap="round"
            strokeLinejoin="round" strokeDasharray="2 7" opacity={0.55} />
        ))}

        {/* buildings */}
        {cityMapData.buildings.map((b) => {
          const isRestaurant = b.type === "restaurant";
          const active = activeRestaurants.has(b.nodeId);
          return (
            <g key={b.id}>
              {isRestaurant && active && (
                <circle cx={b.x} cy={b.y} r={16} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.5}>
                  <animate attributeName="r" values="15;22;15" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={b.x} cy={b.y} r={isRestaurant ? 15 : 12} fill="#ffffff"
                stroke={isRestaurant ? "#f97316" : "#cbd5e1"} strokeWidth={isRestaurant ? 2 : 1.5}
                filter="url(#chipShadow)" />
              <text x={b.x} y={b.y + (isRestaurant ? 5 : 4)} fontSize={isRestaurant ? 15 : 12} textAnchor="middle">
                {b.icon}
              </text>
              {isRestaurant && (
                <text x={b.x} y={b.y + 30} fontSize={9.5} fontWeight={600} textAnchor="middle"
                  fill="#586179" stroke="#fff" strokeWidth={3} paintOrder="stroke" style={{ paintOrder: "stroke" }}>
                  {b.name}
                </text>
              )}
            </g>
          );
        })}

        {/* drivers */}
        {drivers.map((d) => {
          const p = driverPos(d);
          const ring = statusColor[d.status] ?? "#94a3b8";
          const active = d.status === "EN_ROUTE_PICKUP" || d.status === "DELIVERING";
          return (
            <g key={d.id} transform={`translate(${p.x} ${p.y})`}>
              {active && (
                <circle r={14} fill={ring} opacity={0.18}>
                  <animate attributeName="r" values="11;18;11" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={12} fill="#ffffff" stroke={ring} strokeWidth={2.5} filter="url(#chipShadow)" />
              <text y={4.5} fontSize={13} textAnchor="middle">{d.vehicleType === "CAR" ? "🚗" : "🚲"}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
