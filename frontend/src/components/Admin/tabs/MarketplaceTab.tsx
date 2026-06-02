import { usePlatformStore } from '../../../store/platformStore';
import type { DispatchAttempt, DispatchCandidate } from '../../../store/platformStore';
import { api } from '../../../services/api';
import CityMapSVG from '../../Map/CityMapSVG';
import { useState, useEffect, useRef } from 'react';
import type { Driver, Order, Metrics } from '../../../types';
import type { QueueMetric } from '../../../store/platformStore';
import { BUILDINGS, ROAD_NODES, ROAD_EDGES } from '../../../data/cityMap';

/* ─── Constants ─── */

const STATUS_LABELS: Record<string, string> = {
  IDLE:                    'Idle',
  EN_ROUTE_PICKUP:         'En route to pickup',
  WAITING_AT_RESTAURANT:   'Waiting at restaurant',
  DELIVERING:              'Delivering',
  ON_BREAK:                'On break',
  OFFLINE:                 'Offline',
};

const STATUS_COLORS: Record<string, string> = {
  IDLE:                   '#94A3B8',
  EN_ROUTE_PICKUP:        '#F97316',
  WAITING_AT_RESTAURANT:  '#F59E0B',
  DELIVERING:             '#22C55E',
  ON_BREAK:               '#94A3B8',
  OFFLINE:                '#64748B',
};

const STEP_COLORS = ['#94A3B8', '#F97316', '#F59E0B', '#22C55E'];

const MOOD_EMOJI: Record<string, string> = {
  HAPPY: '😊', WAITING: '🕐', FRUSTRATED: '😤', ANGRY: '😡',
};

const STATUS_STEP: Record<string, number> = {
  IDLE: 0, EN_ROUTE_PICKUP: 1, WAITING_AT_RESTAURANT: 2, DELIVERING: 3,
};

const STRATEGIES: {
  key: string; label: string; icon: string;
  color: string; desc: string; tradeoff: string;
}[] = [
  {
    key: 'FASTEST_ETA', label: 'Fastest ETA', icon: '⚡', color: '#38BDF8',
    desc: 'Always picks the closest driver. Minimizes customer wait time.',
    tradeoff: 'Overworks nearby drivers → higher fatigue → more breaks → some zones underserved',
  },
  {
    key: 'LOWEST_COST', label: 'Lowest Cost', icon: '$', color: '#28B86A',
    desc: 'Picks the driver who covers the least distance. Minimizes fleet miles.',
    tradeoff: 'Slower deliveries for distant orders → customers wait longer → satisfaction drops',
  },
  {
    key: 'BALANCED', label: 'Balanced', icon: '⚖️', color: '#0EA5E9',
    desc: 'Weighs distance, ETA, driver experience, and fatigue equally.',
    tradeoff: 'Jack of all trades — never the fastest or cheapest, but avoids worst-case outcomes',
  },
  {
    key: 'BATCH_NEARBY', label: 'Batch Nearby', icon: '📦', color: '#14B8A6',
    desc: 'Groups nearby orders for the same driver. Reduces redundant trips.',
    tradeoff: 'First customer in batch waits longer while driver picks up other orders',
  },
  {
    key: 'BATCH_OPTIMAL', label: 'Batch Optimal', icon: '🧠', color: '#7DD3FC',
    desc: 'Uses TSP heuristic to find the shortest multi-pickup route.',
    tradeoff: 'Best fleet efficiency, but higher individual latency. Needs enough order density.',
  },
];

const STRATEGY_WEIGHTS: Record<string, { label: string; weight: number }[]> = {
  BALANCED: [
    { label: 'Distance', weight: 30 },
    { label: 'ETA', weight: 35 },
    { label: 'Reliability', weight: 20 },
    { label: 'Fatigue', weight: 15 },
  ],
  FASTEST_ETA: [
    { label: 'ETA', weight: 65 },
    { label: 'Distance', weight: 20 },
    { label: 'Reliability', weight: 10 },
    { label: 'Fatigue', weight: 5 },
  ],
  LOWEST_COST: [
    { label: 'Distance', weight: 60 },
    { label: 'ETA', weight: 20 },
    { label: 'Reliability', weight: 10 },
    { label: 'Fatigue', weight: 10 },
  ],
  BATCH_NEARBY: [
    { label: 'Batch Fit', weight: 45 },
    { label: 'Distance', weight: 30 },
    { label: 'ETA', weight: 15 },
    { label: 'Reliability', weight: 10 },
  ],
  BATCH_OPTIMAL: [
    { label: 'Route Gain', weight: 50 },
    { label: 'Distance', weight: 25 },
    { label: 'ETA', weight: 15 },
    { label: 'Reliability', weight: 10 },
  ],
};

const ORDER_STAGES: { status: string; label: string; icon: string; color: string }[] = [
  { status: 'CREATED',           label: 'Matching',  icon: '🆕', color: '#2563EB' },
  { status: 'FINDING_DRIVER',    label: 'Matching',  icon: '🔍', color: '#3B6FF5' },
  { status: 'EN_ROUTE_PICKUP',   label: 'Pickup',    icon: '🏃', color: '#F97316' },
  { status: 'WAITING_FOR_FOOD',  label: 'Prep',      icon: '🍳', color: '#F59E0B' },
  { status: 'PICKED_UP',         label: 'Picked Up', icon: '✅', color: '#22C55E' },
  { status: 'EN_ROUTE_DELIVERY', label: 'Delivering',icon: '🚗', color: '#22C55E' },
  { status: 'DELIVERED',         label: 'Done',      icon: '🏠', color: '#16A34A' },
  { status: 'DELAYED',           label: 'Delayed',   icon: '⚠️', color: '#EF4444' },
];

const LEGEND = [
  { symbol: '🟢', label: 'Idle driver',        desc: 'Available and waiting for an order' },
  { symbol: '🔵', label: 'En route to pickup', desc: 'Heading to the restaurant' },
  { symbol: '🟡', label: 'Waiting',            desc: 'Food is still being prepared' },
  { symbol: '🟠', label: 'Delivering',          desc: 'Carrying food to the customer' },
  { symbol: '🔴', label: 'On break / Offline', desc: 'Fatigued or taken offline' },
  { symbol: '🍽️', label: 'Restaurant',         desc: 'Order pickup location' },
  { symbol: '🏠', label: 'Customer drop-off',  desc: 'Delivery destination building' },
  { symbol: '🔥', label: 'Zone heat',          desc: 'SURGE → HIGH → MEDIUM → LOW demand' },
  { symbol: '⚡', label: 'Incident overlay',   desc: 'Traffic jam slowing routes' },
];

/* ─── Helpers ─── */

function formatStrategy(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function driverUtilization(d: Driver): number {
  if (d.status === 'IDLE' || d.status === 'ON_BREAK' || d.status === 'OFFLINE') return 0;
  if (d.status === 'DELIVERING') return Math.min(100, 72 + Math.round(d.fatigue * 0.2));
  if (d.status === 'EN_ROUTE_PICKUP') return 58;
  if (d.status === 'WAITING_AT_RESTAURANT') return 42;
  return 25;
}

function driverEtaLabel(driver: Driver, order?: Order): string {
  if (driver.status === 'IDLE') return 'On standby';
  if (driver.status === 'ON_BREAK') return 'On break';
  if (order?.estimatedDeliveryTime) {
    const mins = Math.max(1, Math.round(order.estimatedDeliveryTime / 60));
    return `ETA ${mins}m`;
  }
  if (driver.status === 'WAITING_AT_RESTAURANT' && order?.cookTimeRemaining != null)
    return `Prep ~${Math.round(order.cookTimeRemaining)} ticks`;
  return 'En route';
}

function driverAssignment(driver: Driver, order?: Order): string {
  if (!order) return 'No active order';
  if (driver.status === 'DELIVERING') return order.customerName;
  return order.restaurantName;
}

function statusShortLabel(status: Driver['status']): string {
  const map: Record<string, string> = {
    IDLE: 'Idle', EN_ROUTE_PICKUP: 'To Restaurant', WAITING_AT_RESTAURANT: 'Waiting',
    DELIVERING: 'Delivering', ON_BREAK: 'On Break', OFFLINE: 'Offline',
  };
  return map[status] ?? status;
}

type NarratorState = {
  icon: string; color: string; label: string; text: string; subtext?: string; statusPill: string;
};

function MapKpiStrip({
  metrics, drivers, orders, queues,
}: {
  metrics: Metrics; drivers: Driver[]; orders: Order[]; queues: QueueMetric[];
}) {
  const activeOrderCount = orders.filter(o => o.status !== 'DELIVERED').length;
  const availableDrivers = drivers.filter(d => d.status === 'IDLE').length;
  const avgEta = metrics.averageEta > 0 ? `${Math.round(metrics.averageEta)}s` : '—';
  const dispatchQueue = queues.find(q => /dispatch/i.test(q.name));
  const latency = dispatchQueue ? `${Math.round(dispatchQueue.consumerLag)}ms` : '0ms';
  const successPct = metrics.dispatchSuccessRate > 0
    ? Math.round(metrics.dispatchSuccessRate <= 1 ? metrics.dispatchSuccessRate * 100 : metrics.dispatchSuccessRate)
    : 100;

  const cards = [
    { label: 'Active Orders', value: String(activeOrderCount), icon: '📦', color: '#F97316' },
    { label: 'Available Drivers', value: String(availableDrivers), icon: '🚗', color: '#22C55E' },
    { label: 'Avg ETA', value: avgEta, icon: '⏱', color: '#8B5CF6' },
    { label: 'Dispatch Latency', value: latency, icon: '⚡', color: '#3B82F6' },
    { label: 'Queue Backlog', value: String(metrics.pendingOrders), icon: '📊', color: '#F59E0B' },
    { label: 'Success Rate', value: `${successPct}%`, icon: '✓', color: '#22C55E' },
  ];

  return (
    <div className="kpi-compact-row">
      {cards.map(c => (
        <div key={c.label} className="kpi-compact-card">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-label" style={{ fontSize: 8, lineHeight: 1.2 }}>{c.label}</span>
            <span style={{ fontSize: 12, color: c.color }}>{c.icon}</span>
          </div>
          <div className="text-[16px] font-extrabold leading-none tracking-tight" style={{ color: '#0F172A' }}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function stageIndex(status: string): number {
  const i = ORDER_STAGES.findIndex(s => s.status === status);
  return i === -1 ? 0 : i;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="progress-track h-1.5">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, borderRadius: 999, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}
      />
    </div>
  );
}

/* ─── Map Guide ─── */

function MapGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute top-3 right-3 z-10 w-80 text-xs float-in-up clay-card-sm"
      style={{ padding: 16 }}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="font-bold text-[13px]" style={{ color: '#1A3550' }}>Reading the Map</div>
        <button
          onClick={onClose}
          className="text-[10px] px-2.5 py-1 rounded-lg font-semibold"
          style={{ background: '#EEF3F7', color: '#4A7494' }}
        >
          Close
        </button>
      </div>
      <p className="mb-3 leading-relaxed" style={{ color: '#4A7494' }}>
        A live delivery network. Each marker is a driver moving in real-time along the road graph.
        Orders flow from restaurants to homes and offices. Use the controls to start the stream,
        change speed, or adjust dispatch strategy — and monitor the marketplace response.
      </p>
      <div className="flex flex-col gap-2">
        {LEGEND.map(item => (
          <div key={item.label} className="flex gap-2 items-start">
            <span className="text-sm leading-none mt-0.5">{item.symbol}</span>
            <div>
              <span className="font-semibold" style={{ color: '#1A3550' }}>{item.label}</span>
              <span style={{ color: '#6A8FA8' }}> — {item.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-3 pt-3 text-[10px] leading-relaxed"
        style={{ borderTop: '1px solid #EEF3F7', color: '#6A8FA8' }}
      >
        <b style={{ color: '#4A7494' }}>What to watch for:</b> When demand spikes or an incident
        fires, see how drivers reroute and how P50 latency reacts. Switch dispatch strategy in
        the <b>Dispatch</b> tab to compare behaviour.
      </div>
    </div>
  );
}

/* ─── Driver Popup ─── */

function DriverPopup({
  driver, activeOrders, onClose, onForceOffline, onBringOnline,
}: {
  driver: Driver; activeOrders: Order[];
  onClose: () => void; onForceOffline: () => void; onBringOnline: () => void;
}) {
  const statusColor = STATUS_COLORS[driver.status] ?? '#6A8FA8';
  const currentOrder = activeOrders[0];
  const node = ROAD_NODES.find(n => n.id === driver.currentNodeId);
  const currentZone = node?.zone ?? 'Unknown zone';
  const reliability = Math.max(60, Math.min(99, Math.round(driver.rating * 18 - driver.fatigue * 0.2)));
  const util = driverUtilization(driver);

  return (
    <div
      className="absolute bottom-4 left-4 z-20 w-72 text-xs overflow-hidden float-in-up clay-popup"
      style={{ borderColor: `${statusColor}55` }}
    >
      {/* Header */}
      <div
        className="px-3.5 py-3 flex items-center justify-between gap-2"
        style={{
          background: statusColor + '14',
          borderBottom: '1px solid rgba(223,228,234,0.6)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: statusColor + '20' }}
          >
            {driver.vehicleType === 'CAR' ? '🚗' : '🚴'}
          </div>
          <div>
            <div className="font-extrabold text-[14px]" style={{ color: '#0F172A' }}>{driver.name}</div>
            <div className="text-[10px] font-semibold" style={{ color: '#64748B' }}>
              {driver.vehicleType === 'CAR' ? 'Car' : 'Bike'} · {currentZone}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-2 py-1 rounded-full"
            style={{ background: statusColor + '16', color: statusColor }}
          >
            {STATUS_LABELS[driver.status] ?? driver.status}
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px]"
            style={{ background: 'rgba(255,255,255,0.7)', color: '#4A7494' }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Rating', value: `${driver.rating.toFixed(1)} ★` },
            { label: 'Deliveries', value: driver.totalDeliveries },
            { label: 'Experience', value: `Lv ${driver.experience}` },
          ].map(({ label, value }) => (
            <div key={label} className="clay-stat-tile py-2">
              <div className="font-bold text-[11px]" style={{ color: '#0F172A' }}>{value}</div>
              <div className="text-[9px]" style={{ color: '#64748B' }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="clay-stat-tile px-2.5 py-2">
            <div className="text-[9px] text-label" style={{ letterSpacing: '0.06em' }}>Reliability</div>
            <div className="text-[12px] font-extrabold mt-0.5" style={{ color: '#0F172A' }}>{reliability}%</div>
          </div>
          <div className="clay-stat-tile px-2.5 py-2">
            <div className="text-[9px] text-label" style={{ letterSpacing: '0.06em' }}>Utilization</div>
            <div className="text-[12px] font-extrabold mt-0.5" style={{ color: '#0F172A' }}>{util}%</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1 text-[10px]" style={{ color: '#64748B' }}>
            <span>Fatigue</span>
            <span>{driver.fatigue.toFixed(0)} / 80</span>
          </div>
          <Bar
            value={driver.fatigue} max={80}
            color={driver.fatigue > 60 ? '#C46B58' : driver.fatigue > 40 ? '#C4923A' : '#28B86A'}
          />
        </div>

        <div className="clay-stat-tile px-2.5 py-2">
          <div className="text-[9px] text-label mb-1">Current Order</div>
          {currentOrder ? (
            <>
              <div className="text-[12px] font-bold truncate" style={{ color: '#0F172A' }}>
                {currentOrder.customerName}
              </div>
              <div className="text-[10px] truncate mt-0.5" style={{ color: '#64748B' }}>
                {currentOrder.restaurantName}
              </div>
            </>
          ) : (
            <div className="text-[11px]" style={{ color: '#64748B' }}>No active order assigned</div>
          )}
        </div>

        {driver.thoughtMessage && (
          <div
            className="rounded-xl px-2.5 py-1.5 text-[10px] italic"
            style={{ background: 'rgba(59,111,245,0.06)', color: '#475569' }}
          >
            💭 {driver.thoughtMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            className="py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: '#EEF4F7', color: '#475569', border: '1px solid rgba(71,85,105,0.16)' }}
          >
            Move Zone
          </button>
          <button
            className="py-1.5 rounded-xl text-[10px] font-semibold"
            style={{ background: '#EEF4F7', color: '#475569', border: '1px solid rgba(71,85,105,0.16)' }}
          >
            Assign Order
          </button>
        </div>

        <div className="flex gap-2">
          {driver.status === 'OFFLINE' || driver.status === 'ON_BREAK' ? (
            <button
              onClick={onBringOnline}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background: '#28B86A18', color: '#28B86A', border: '1px solid #28B86A44' }}
            >
              Bring Online
            </button>
          ) : (
            <button
              onClick={onForceOffline}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              Force Offline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Building Popup ─── */

function BuildingPopup({
  buildingId, orders, onClose, onBoostPriority,
}: {
  buildingId: string; orders: Order[];
  onClose: () => void; onBoostPriority: (id: string) => void;
}) {
  const building = BUILDINGS.find(b => b.id === buildingId);
  if (!building) return null;

  const isRestaurant = building.type === 'restaurant';
  const relevantOrders = isRestaurant
    ? orders.filter(o => o.restaurantNodeId === building.nodeId && o.status !== 'DELIVERED')
    : orders.filter(o => o.customerNodeId === building.nodeId && o.status !== 'DELIVERED');

  return (
    <div
      className="absolute bottom-4 left-4 z-20 w-64 text-xs overflow-hidden float-in-up clay-popup"
      style={{ borderColor: 'rgba(114,141,166,0.45)' }}
    >
      <div
        className="px-3.5 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(59,111,245,0.07)',
          borderBottom: '1px solid rgba(223,228,234,0.6)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: 'rgba(59,111,245,0.10)' }}
          >
            {building.icon}
          </div>
          <div>
            <div className="font-bold text-[13px]" style={{ color: '#1A3550' }}>{building.name}</div>
            <div className="text-[10px] capitalize" style={{ color: '#6A8FA8' }}>
              {building.type} · {building.zone}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[12px]"
          style={{ background: 'rgba(255,255,255,0.7)', color: '#4A7494' }}
        >
          ✕
        </button>
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-2">
        {relevantOrders.length === 0 ? (
          <div className="text-center py-3" style={{ color: '#6A8FA8' }}>
            {isRestaurant ? 'No pending orders at this restaurant' : 'No deliveries inbound'}
          </div>
        ) : (
          <>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6A8FA8' }}>
              {isRestaurant
                ? `${relevantOrders.length} order${relevantOrders.length !== 1 ? 's' : ''} queued`
                : `${relevantOrders.length} inbound`}
            </div>
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {relevantOrders.map(o => (
                <div key={o.id} className="clay-stat-tile px-2.5 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold" style={{ color: '#1A3550' }}>
                      {MOOD_EMOJI[o.mood] ?? ''} {o.customerName}
                    </span>
                    <span className="font-mono text-[9px]" style={{ color: '#6A8FA8' }}>#{o.id}</span>
                  </div>
                  <div className="flex justify-between text-[10px]" style={{ color: '#6A8FA8' }}>
                    <span className="capitalize">{o.status.replace(/_/g, ' ').toLowerCase()}</span>
                    <span>${o.estimatedValue.toFixed(2)}</span>
                  </div>
                  {o.cookTimeRemaining != null && o.cookTimeRemaining > 0 && (
                    <div className="mt-1 text-[9px]" style={{ color: '#C4923A' }}>
                      🍳 ~{o.cookTimeRemaining.toFixed(0)} ticks prep
                    </div>
                  )}
                  {o.delayReason && (
                    <div className="mt-1 text-[9px]" style={{ color: '#C46B58' }}>⚠ {o.delayReason}</div>
                  )}
                  <button
                    onClick={() => onBoostPriority(o.id)}
                    className="mt-1.5 w-full py-1 rounded-lg text-[10px] font-semibold"
                    style={{ background: 'rgba(59,111,245,0.08)', color: '#0EA5E9' }}
                  >
                    ↑ Boost Priority
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Dispatch Flash ─── */

function DispatchFlash({ attempt, onDismiss }: { attempt: DispatchAttempt; onDismiss: () => void }) {
  const sorted = [...(attempt.candidates ?? [])].sort((a, b) => b.score - a.score);
  return (
    <div
      className="absolute top-24 left-3 z-30 text-[10px] animate-fade-in-left clay-card-sm"
      style={{ maxWidth: 220, overflow: 'hidden', borderColor: 'rgba(114,141,166,0.35)' }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between gap-2"
        style={{ background: 'rgba(59,111,245,0.06)', borderBottom: '1px solid rgba(59,111,245,0.12)' }}
      >
        <div className="flex items-center gap-1.5">
          <span>⚡</span>
          <span className="font-bold" style={{ color: '#0EA5E9' }}>{attempt.restaurantName}</span>
        </div>
        <button onClick={onDismiss} style={{ color: '#6A8FA8' }}>✕</button>
      </div>
      <div className="px-3 py-2">
        {sorted.filter(c => c.selected).map((c: DispatchCandidate) => (
          <div key={c.driverId} className="flex items-center gap-1.5">
            <span style={{ color: '#28B86A' }}>✓</span>
            <span>{c.vehicleType === 'CAR' ? '🚗' : '🚴'}</span>
            <span className="font-semibold" style={{ color: '#1A3550' }}>{c.driverName}</span>
            <span className="ml-auto font-mono font-bold" style={{ color: '#0EA5E9' }}>
              {c.score.toFixed(0)}pts
            </span>
          </div>
        ))}
        <div className="mt-0.5 text-[9px]" style={{ color: '#6A8FA8' }}>{attempt.strategy}</div>
      </div>
    </div>
  );
}

/* ─── Driver Card ─── */

function DriverCard({
  driver, order, onSelect, isSelected,
}: {
  driver: Driver; order?: Order; onSelect: () => void; isSelected: boolean;
}) {
  const color = STATUS_COLORS[driver.status] ?? '#94A3B8';
  const step  = STATUS_STEP[driver.status] ?? 0;
  const util  = driverUtilization(driver);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left transition-all fleet-card ${isSelected ? 'fleet-card-active' : ''}`}
      style={{ padding: '12px', minHeight: 96 }}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <div
          className="nav-icon-raised flex items-center justify-center text-lg flex-shrink-0"
          style={{ width: 36, height: 36, background: color + '18' }}
        >
          {driver.vehicleType === 'CAR' ? '🚗' : '🚴'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[15px] font-extrabold" style={{ color: '#0F172A' }}>
              {driver.name.split(' ')[0]}
            </span>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: color + '18', color }}
            >
              {statusShortLabel(driver.status)}
            </span>
          </div>
          <div className="text-[11px] font-medium truncate" style={{ color: '#475569' }}>
            {driverAssignment(driver, order)}
          </div>
          <div className="text-[10px] font-semibold mt-0.5" style={{ color: '#64748B' }}>
            {driverEtaLabel(driver, order)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {['Idle', 'Pickup', 'Waiting', 'Delivering'].map((lbl, i) => (
          <span key={lbl} className="flex items-center gap-1">
            {i > 0 && <span style={{ color: '#CBD5E1', fontSize: 8 }}>|</span>}
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: i === step ? STEP_COLORS[i] + '22' : 'transparent',
                color: i === step ? STEP_COLORS[i] : '#94A3B8',
              }}
            >
              {lbl}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 progress-track" style={{ height: 6 }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${util}%`, background: STEP_COLORS[Math.min(step, 3)] || '#94A3B8' }}
          />
        </div>
        <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: '#64748B' }}>
          Util {util}%
        </span>
      </div>
    </button>
  );
}

/* ─── Active Order Card ─── */

function ActiveOrderCard({ order, drivers }: { order: Order; drivers: Driver[] }) {
  const stage = ORDER_STAGES.find(s => s.status === order.status) ?? ORDER_STAGES[0];
  const pct   = Math.min(100, Math.round((stageIndex(order.status) / (ORDER_STAGES.length - 2)) * 100));
  const driver = drivers.find(d => d.id === order.driverId);
  const eta = order.estimatedDeliveryTime
    ? `ETA ~${Math.max(1, Math.round(order.estimatedDeliveryTime / 60))}m`
    : '—';
  const atRisk = order.status === 'DELAYED' || !!order.delayReason;

  return (
    <div className="active-order-card px-3 py-2.5" style={{ borderLeftColor: stage.color }}>
      <div className="flex items-center justify-between mb-1 gap-1">
        <span className="text-[12px] font-extrabold truncate" style={{ color: '#0F172A' }}>
          {MOOD_EMOJI[order.mood] ?? ''} {order.customerName}
        </span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: stage.color + '18', color: stage.color }}>
          {stage.label}
        </span>
      </div>
      <div className="text-[11px] truncate mb-1" style={{ color: '#475569' }}>{order.restaurantName}</div>
      <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: '#64748B' }}>
        <span>{driver ? `Driver: ${driver.name.split(' ')[0]}` : 'Driver: pending'}</span>
        <span className="font-semibold">{eta}</span>
      </div>
      {atRisk && (
        <div className="text-[9px] font-bold mb-1" style={{ color: '#EF4444' }}>⚠ At risk</div>
      )}
      <div className="progress-track h-1.5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: stage.color }} />
      </div>
    </div>
  );
}

/* ─── Narrator ─── */

function useNarrator(
  simulation: { running: boolean; paused: boolean; tickCount: number; dispatchStrategy: string },
  drivers: Driver[],
  orders: Order[],
  recentDispatch: DispatchAttempt[],
  recentEvents: any[],
): NarratorState {
  const latestEvent    = recentEvents[0];
  const latestDispatch = recentDispatch[0];
  const t = latestEvent?.type ?? '';
  const strat = formatStrategy(simulation.dispatchStrategy);

  if (!simulation.running) {
    return {
      icon: '⏻', color: '#64748B', label: 'System Status',
      text: 'Stream offline',
      subtext: 'Start the event stream to process marketplace events.',
      statusPill: 'Offline',
    };
  }
  if (simulation.paused) {
    return {
      icon: '⏸', color: '#F59E0B', label: 'System Status',
      text: 'Operations paused',
      subtext: 'Resume the stream or switch dispatch strategy to continue routing.',
      statusPill: 'Paused',
    };
  }

  if (t === 'INCIDENT_CREATED') {
    return {
      icon: '🚨', color: '#EF4444', label: 'Incident Alert',
      text: latestEvent?.message ?? 'Active incident on network',
      subtext: 'Affected drivers rerouting — monitor map overlay.',
      statusPill: 'Critical',
    };
  }
  if (t === 'DRIVER_REROUTED') {
    return {
      icon: '🔄', color: '#EF4444', label: 'Route Update',
      text: latestEvent?.message ?? 'Driver rerouting',
      subtext: 'Recalculating path around incident.',
      statusPill: 'Degraded',
    };
  }
  if (t === 'ORDER_DELIVERED') {
    return {
      icon: '✅', color: '#22C55E', label: 'Delivery Complete',
      text: latestEvent?.message?.replace('Order delivered to ', '') ?? 'Order delivered',
      subtext: `Driver returning to idle · tick ${simulation.tickCount}`,
      statusPill: 'Live',
    };
  }
  if (t === 'DRIVER_BREAK') {
    return {
      icon: '☕', color: '#F59E0B', label: 'Fleet Alert',
      text: latestEvent?.message ?? 'Driver on mandatory break',
      subtext: simulation.dispatchStrategy === 'FASTEST_ETA'
        ? 'Fastest ETA strategy — consider Balanced to reduce fatigue spikes.'
        : 'Driver out of rotation until fatigue recovers.',
      statusPill: 'Degraded',
    };
  }

  const onBreak = drivers.filter(d => d.status === 'ON_BREAK');
  if (onBreak.length > 0) {
    const idle = drivers.filter(d => d.status === 'IDLE').length;
    return {
      icon: '☕', color: '#F59E0B', label: 'Fleet Status',
      text: `${onBreak.map(d => d.name.split(' ')[0]).join(', ')} on break`,
      subtext: idle === 0
        ? 'No idle drivers — orders may queue until break ends.'
        : `${idle} driver${idle !== 1 ? 's' : ''} available · ${strat} dispatch active`,
      statusPill: 'Degraded',
    };
  }

  if (latestDispatch?.matched && latestDispatch.timestamp > Date.now() - 8000) {
    const assigned = drivers.find(d => d.name === latestDispatch.selectedDriverName);
    const routeHint = assigned?.status === 'DELIVERING'
      ? 'Delivery route active'
      : assigned?.status === 'EN_ROUTE_PICKUP'
      ? 'Pickup route active'
      : assigned?.status === 'WAITING_AT_RESTAURANT'
      ? 'Waiting at restaurant'
      : 'Assignment confirmed';
    return {
      icon: '⚡', color: '#3B6FF5', label: 'Active Dispatch',
      text: `${latestDispatch.selectedDriverName} → ${latestDispatch.restaurantName}`,
      subtext: `${strat} selected · ${routeHint} · tick ${simulation.tickCount}`,
      statusPill: 'Live',
    };
  }

  const delivering = drivers.filter(d => d.status === 'DELIVERING');
  const waiting    = drivers.filter(d => d.status === 'WAITING_AT_RESTAURANT');
  const enRoute    = drivers.filter(d => d.status === 'EN_ROUTE_PICKUP');
  const pending    = orders.filter(o => o.status === 'CREATED' || o.status === 'FINDING_DRIVER');

  if (waiting.length > 0) {
    const w = waiting[0];
    const o = orders.find(x => x.driverId === w.id);
    return {
      icon: '🍳', color: '#F59E0B', label: 'Active Dispatch',
      text: `${w.name.split(' ')[0]} → ${o?.restaurantName ?? 'restaurant'}`,
      subtext: o?.cookTimeRemaining
        ? `Food prep · ~${o.cookTimeRemaining.toFixed(0)} ticks remaining · ${strat}`
        : `${strat} · Waiting at pickup`,
      statusPill: 'Live',
    };
  }
  if (enRoute.length > 0) {
    const d = enRoute[0];
    const o = orders.find(x => x.driverId === d.id);
    return {
      icon: '🏃', color: '#F97316', label: 'Active Dispatch',
      text: `${d.name.split(' ')[0]} → ${o?.restaurantName ?? 'pickup'}`,
      subtext: `${strat} selected · Pickup route active · tick ${simulation.tickCount}`,
      statusPill: 'Live',
    };
  }
  if (delivering.length > 0) {
    const d = delivering[0];
    return {
      icon: '📦', color: '#22C55E', label: 'Active Dispatch',
      text: `${d.name.split(' ')[0]} → customer drop-off`,
      subtext: `${strat} selected · Delivery route active · tick ${simulation.tickCount}`,
      statusPill: 'Live',
    };
  }
  if (pending.length > 0) {
    return {
      icon: '🔍', color: '#3B6FF5', label: 'Queue Status',
      text: `${pending.length} order${pending.length !== 1 ? 's' : ''} awaiting assignment`,
      subtext: `${strat} dispatch scoring available drivers · tick ${simulation.tickCount}`,
      statusPill: 'Live',
    };
  }

  return {
    icon: '📍', color: '#64748B', label: 'Marketplace Status',
    text: 'Network idle — awaiting next order',
    subtext: `${drivers.filter(d => d.status === 'IDLE').length} drivers on standby · ${strat} dispatch`,
    statusPill: 'Live',
  };
}

/* ─── Story Feed ─── */

interface StoryItem {
  id: string; icon: string; color: string; eventType: string;
  headline: string; source?: string; tick: number; timestamp?: number; latencyMs?: number;
}

const SAMPLE_EVENT_CHIPS = ['OrderCreated', 'DriverMatched', 'RouteCalculated', 'OrderDelivered'];

function eventToStory(ev: {
  id: string; type: string; category: string;
  severity: string; message: string; tick: number; timestamp?: number;
}): StoryItem {
  const t   = ev.type ?? '';
  const msg = ev.message ?? '';
  const sev = ev.severity ?? 'info';
  const col = sev === 'critical' ? '#EF4444' : sev === 'warning' ? '#F59E0B' : '#22C55E';
  const base = { tick: ev.tick, timestamp: ev.timestamp, latencyMs: 120 + (ev.tick % 80) };

  if (t === 'ORDER_CREATED')      return { id: ev.id, icon: '🛍️', color: '#64748B', eventType: 'OrderCreated',   headline: msg.replace('Order created at ', ''), source: 'Order Service', ...base };
  if (t === 'ORDER_FOOD_READY')   return { id: ev.id, icon: '👨‍🍳', color: '#F59E0B', eventType: 'FoodReady',      headline: msg, source: 'Restaurant', ...base };
  if (t === 'DRIVER_ASSIGNED')    return { id: ev.id, icon: '⚡',  color: '#8B5CF6', eventType: 'DriverMatched',  headline: msg, source: 'Dispatch Engine', ...base };
  if (t === 'DRIVER_PICKED_UP')   return { id: ev.id, icon: '🏃',  color: '#F97316', eventType: 'PickupComplete', headline: msg, source: 'Driver Runtime', ...base };
  if (t === 'ORDER_DELIVERED')    return { id: ev.id, icon: '✅',  color: '#22C55E', eventType: 'OrderDelivered', headline: msg, source: 'Order Service', ...base };
  if (t === 'DRIVER_REROUTED')    return { id: ev.id, icon: '🔄',  color: '#EF4444', eventType: 'RouteCalculated', headline: msg, source: 'Driver Runtime', ...base };
  if (t === 'INCIDENT_CREATED')   return { id: ev.id, icon: '⚠️',  color: '#EF4444', eventType: 'IncidentOpened', headline: msg, source: 'Incident Service', ...base };
  if (t === 'INCIDENT_RESOLVED')  return { id: ev.id, icon: '✓',   color: '#22C55E', eventType: 'IncidentResolved', headline: msg, source: 'Incident Service', ...base };
  if (t === 'DRIVER_ON_BREAK')    return { id: ev.id, icon: '😴',  color: '#94A3B8', eventType: 'DriverBreak',    headline: msg, source: 'Driver Runtime', ...base };
  if (t === 'DRIVER_ONLINE')      return { id: ev.id, icon: '🟢',  color: '#22C55E', eventType: 'DriverOnline',   headline: msg, source: 'Driver Runtime', ...base };
  if (t === 'ORDER_DELAYED')      return { id: ev.id, icon: '⏳',  color: '#EF4444', eventType: 'OrderDelayed',   headline: msg, source: 'Order Service', ...base };
  if (t === 'DISPATCH_NO_DRIVER') return { id: ev.id, icon: '❓',  color: '#F59E0B', eventType: 'NoDriver',       headline: msg, source: 'Dispatch Engine', ...base };

  const catSource = ev.category === 'ORDER' ? 'Order Service' : ev.category === 'DRIVER' ? 'Driver Runtime' : ev.category === 'INCIDENT' ? 'Incident Service' : 'Platform';
  if (ev.category === 'ORDER')    return { id: ev.id, icon: '📦', color: '#64748B', eventType: 'OrderEvent',     headline: msg.slice(0, 55), source: catSource, ...base };
  if (ev.category === 'INCIDENT') return { id: ev.id, icon: '⚠️', color: col,       eventType: 'Incident',       headline: msg.slice(0, 55), source: catSource, ...base };
  if (ev.category === 'DRIVER')   return { id: ev.id, icon: '🚗', color: '#64748B', eventType: 'DriverEvent',    headline: msg.slice(0, 55), source: catSource, ...base };
  return                           { id: ev.id, icon: '•',  color: '#64748B', eventType: 'SystemEvent',    headline: msg.slice(0, 55), source: catSource, ...base };
}

function formatEventTime(ts?: number, tick?: number): string {
  if (ts) return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return tick != null ? `tick ${tick}` : '—';
}

function StoryFeed({ events, isLive, compact = false }: { events: any[]; isLive: boolean; compact?: boolean }) {
  const stories = events.slice(0, compact ? 6 : 20).map(eventToStory);
  const latestSeverity = events[0]?.severity;
  const streamState = !isLive ? 'IDLE' : (latestSeverity === 'warning' || latestSeverity === 'critical') ? 'DEGRADED' : 'LIVE';
  const streamColor = streamState === 'LIVE' ? '#16A34A' : streamState === 'DEGRADED' ? '#F59E0B' : '#64748B';

  return (
    <div className="flex flex-col h-full clay-card" style={{ borderRadius: 20, overflow: 'hidden', padding: 0 }}>
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(100,116,139,0.12)' }}
      >
        <span className="text-[13px] font-extrabold" style={{ color: '#0F172A' }}>System Event Stream</span>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: streamColor,
              animation: streamState === 'LIVE' ? 'live-pulse 1.8s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-label" style={{ color: streamColor }}>
            {streamState}
          </span>
        </div>
      </div>

      {/* Events */}
      <div className="flex flex-col overflow-y-auto flex-1">
        {stories.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 py-4 text-center" style={{ minHeight: compact ? 110 : 170 }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB' }}
            >
              ▶
            </div>
            <div className="text-[13px] font-extrabold" style={{ color: '#0F172A' }}>No events yet</div>
            <p className="text-[11px] leading-relaxed" style={{ color: '#64748B' }}>
              Start the stream to watch order, dispatch, routing, and delivery events flow through the marketplace.
            </p>
            {!compact && <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {SAMPLE_EVENT_CHIPS.map(chip => (
                <span key={chip} className="event-chip">{chip}</span>
              ))}
            </div>}
          </div>
        )}
        {stories.map((s, i) => (
          <div
            key={s.id}
            className="px-3 py-2"
            style={{
              borderBottom: '1px solid rgba(71,85,105,0.10)',
              background: i === 0 ? s.color + '08' : 'transparent',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[10px] font-mono font-semibold" style={{ color: '#64748B' }}>
                {formatEventTime(s.timestamp, s.tick)}
              </span>
              <span className="text-[10px] font-extrabold flex items-center gap-1" style={{ color: s.color }}>
                <span>{s.icon}</span><span>{s.eventType}</span>
              </span>
            </div>
            <div className="text-[12px] font-semibold leading-snug mb-0.5" style={{ color: '#0F172A' }}>
              {s.headline.length > 60 ? s.headline.slice(0, 60) + '…' : s.headline}
            </div>
            {s.source && (
              <div className="text-[10px]" style={{ color: '#64748B' }}>
                {s.source} · {s.latencyMs ?? 0}ms
              </div>
            )}
          </div>
        ))}
      </div>

      {stories.length > 0 && !compact && (
        <div
          className="px-4 py-2.5 text-[10px] font-medium flex-shrink-0"
          style={{ borderTop: '1px solid rgba(223,228,234,0.55)', color: '#6A8FA8' }}
        >
          ≡ View full event log
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */

export default function MarketplaceTab() {
  const { metrics, drivers, orders, zones, incidents, simulation, recentDispatch, recentEvents, queues } =
    usePlatformStore();

  const [selectedDriverId,   setSelectedDriverId]   = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [showGuide,          setShowGuide]           = useState(false);
  const [flashDispatch,      setFlashDispatch]       = useState<DispatchAttempt | null>(null);

  const lastDispatchId = useRef<string | null>(null);
  const flashTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const latest = recentDispatch[0];
    if (latest && latest.id !== lastDispatchId.current && latest.matched) {
      lastDispatchId.current = latest.id;
      setFlashDispatch(latest);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashDispatch(null), 5000);
    }
  }, [recentDispatch]);

  const selectedDriver       = selectedDriverId ? (drivers.find(d => d.id === selectedDriverId) ?? null) : null;
  const selectedDriverOrders = selectedDriver
    ? orders.filter(o => o.driverId === selectedDriver.id && o.status !== 'DELIVERED')
    : [];

  const isLive      = simulation.running && !simulation.paused;
  const activeOrders = orders
    .filter(o => o.status !== 'DELIVERED')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 5);

  const narrator = useNarrator(simulation, drivers, orders, recentDispatch, recentEvents);

  const primaryStrategies = STRATEGIES.filter(s =>
    ['FASTEST_ETA', 'LOWEST_COST', 'BALANCED'].includes(s.key));
  const batchStrategies = STRATEGIES.filter(s =>
    ['BATCH_NEARBY', 'BATCH_OPTIMAL'].includes(s.key));
  const currentStrategy = STRATEGIES.find(s => s.key === simulation.dispatchStrategy);
  const strategyWeights = STRATEGY_WEIGHTS[simulation.dispatchStrategy] ?? STRATEGY_WEIGHTS.BALANCED;
  const liveDriverCount = drivers.filter(d => d.status !== 'OFFLINE').length;
  const statusColor = narrator.statusPill === 'Critical'
    ? '#EF4444'
    : narrator.statusPill === 'Degraded' || narrator.statusPill === 'Paused'
    ? '#F59E0B'
    : narrator.statusPill === 'Live'
    ? '#22C55E'
    : '#64748B';

  function activeOrderForDriver(driverId: string) {
    return orders.find(o => o.driverId === driverId && o.status !== 'DELIVERED');
  }

  return (
    <div className="flex flex-col gap-3 pb-6">

      {/* ── Control bar ── */}
      <div className="glass-card control-bar flex items-center flex-shrink-0 flex-wrap">
        <div className="toolbar-group">
          <button
            onClick={() => api.simulation.start().catch(() => api.simulation.resume())}
            className="btn-primary flex items-center gap-2"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.22)', fontSize: 8 }}>▶</span>
            <span>Start Stream</span>
          </button>
          <button onClick={() => api.simulation.pause()} className="btn-secondary flex items-center gap-1.5">
            <span>⏸</span><span>Pause</span>
          </button>
          <button onClick={() => api.simulation.reset()} className="btn-secondary flex items-center gap-1.5">
            <span>↺</span><span>Reset</span>
          </button>
        </div>

        <div className="control-divider" />

        <div className="toolbar-group">
          {[2, 5].map(s => {
            const active = simulation.speedMultiplier === s;
            return (
              <button
                key={s}
                onClick={() => api.simulation.setSpeed(s)}
                className="clay-pill px-3 py-1 text-[12px] font-bold transition-all"
                style={{
                  color: active ? '#2563EB' : '#334155',
                  fontVariantNumeric: 'tabular-nums',
                  background: active ? '#EEF4F7' : 'var(--clay-tray)',
                  boxShadow: 'var(--clay-press-soft)',
                }}
              >
                {s}×
              </button>
            );
          })}
        </div>

        <div className="control-divider" />

        <div className="toolbar-group">
          {primaryStrategies.map(st => {
            const active = simulation.dispatchStrategy === st.key;
            return (
              <button
                key={st.key}
                onClick={() => api.dispatch.setStrategy(st.key)}
                className={active
                  ? 'btn-strategy-active flex items-center gap-1.5 flex-shrink-0'
                  : 'btn-ghost flex items-center gap-1.5 flex-shrink-0'}
              >
                <span>{st.icon}</span><span>{st.label}</span>
              </button>
            );
          })}
        </div>

        <div className="control-divider" />

        <div className="toolbar-group">
          {batchStrategies.map(st => {
            const active = simulation.dispatchStrategy === st.key;
            return (
              <button
                key={st.key}
                onClick={() => api.dispatch.setStrategy(st.key)}
                className={active
                  ? 'btn-strategy-active flex items-center gap-1.5 flex-shrink-0'
                  : 'btn-ghost flex items-center gap-1.5 flex-shrink-0'}
              >
                <span>{st.icon}</span><span>{st.label}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto clay-pill px-3 py-1 text-[12px] font-mono font-semibold flex-shrink-0" style={{ color: '#64748B' }}>
          #{simulation.tickCount}
        </div>
      </div>

      {/* ── Compact KPI row ── */}
      <MapKpiStrip metrics={metrics} drivers={drivers} orders={orders} queues={queues} />

      {/* ── Hero workspace ── */}
      <div
        className="min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: 14,
          minHeight: 'calc(100vh - 250px)',
        }}
      >

        {/* LEFT: Map */}
        <div className="min-h-0 overflow-hidden relative clay-card-map" style={{ padding: 2, minHeight: 640 }}>
          <CityMapSVG
            drivers={drivers}
            orders={orders}
            zoneHeats={zones}
            incidents={incidents as any}
            selectedDriverId={selectedDriverId}
            selectedBuildingId={selectedBuildingId}
            onSelectDriver={setSelectedDriverId}
            onSelectBuilding={setSelectedBuildingId}
            quietMode
          />

          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-[320px]">
            <div className="map-overlay-chip">
              <span>System:</span>
              <span style={{ color: statusColor, fontWeight: 800 }}>{narrator.statusPill.toUpperCase()}</span>
            </div>
            <div className="map-overlay-chip">
              <span>City Graph:</span>
              <span style={{ color: '#64748B' }}>{ROAD_NODES.length} nodes · {ROAD_EDGES.length} roads</span>
            </div>
          </div>
          <div className="absolute top-3 right-3 map-overlay-chip z-10">
            <span>Strategy:</span>
            <span style={{ color: '#0F172A' }}>{formatStrategy(simulation.dispatchStrategy)}</span>
          </div>
          <div className="absolute bottom-3 left-3 map-overlay-chip z-10">
            <span>Live Drivers:</span>
            <span style={{ color: '#0F172A' }}>{liveDriverCount}</span>
          </div>
          <div className="absolute bottom-3 right-3 map-overlay-chip z-10">
            <span>−</span>
            <span style={{ color: '#0F172A' }}>100%</span>
            <span>+</span>
          </div>

          {flashDispatch && !selectedDriverId && !selectedBuildingId && (
            <DispatchFlash attempt={flashDispatch} onDismiss={() => setFlashDispatch(null)} />
          )}

          {!showGuide && !selectedDriverId && !selectedBuildingId && !flashDispatch && (
            <button
              onClick={() => setShowGuide(true)}
              className="absolute top-12 right-3 z-10 btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[11px]"
            >
              <span>?</span>
              <span>Map guide</span>
            </button>
          )}

          {showGuide && <MapGuide onClose={() => setShowGuide(false)} />}

          {selectedDriver && (
            <DriverPopup
              driver={selectedDriver}
              activeOrders={selectedDriverOrders}
              onClose={() => setSelectedDriverId(null)}
              onForceOffline={() => { api.drivers.forceOffline(selectedDriver.id); setSelectedDriverId(null); }}
              onBringOnline={() => { api.drivers.bringOnline(selectedDriver.id); setSelectedDriverId(null); }}
            />
          )}

          {selectedBuildingId && !selectedDriver && (
            <BuildingPopup
              buildingId={selectedBuildingId}
              orders={orders}
              onClose={() => setSelectedBuildingId(null)}
              onBoostPriority={id => api.orders.boostPriority(id)}
            />
          )}
        </div>

        {/* RIGHT: System Event Stream */}
        <div
          className="min-h-0"
          style={{ maxHeight: 640 }}
        >
          <StoryFeed events={recentEvents} isLive={isLive} compact />
        </div>

      </div>

      {/* ── Ops section moved below map ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 14,
          marginTop: 6,
        }}
      >
        <div className="clay-card-sm" style={{ padding: '10px 12px' }}>
          <div className="text-label px-0.5 mb-2">Fleet</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {drivers.filter(d => d.status !== 'OFFLINE').map(d => (
              <div key={d.id} style={{ minWidth: 220, maxWidth: 220, flexShrink: 0 }}>
                <DriverCard
                  driver={d}
                  order={activeOrderForDriver(d.id)}
                  onSelect={() => setSelectedDriverId(prev => prev === d.id ? null : d.id)}
                  isSelected={selectedDriverId === d.id}
                />
              </div>
            ))}
            {drivers.filter(d => d.status === 'OFFLINE').map(d => (
              <div key={d.id} className="clay-stat-tile px-2.5 py-2 text-[10px]" style={{ minWidth: 180, opacity: 0.55 }}>
                <span className="mr-1.5">{d.vehicleType === 'CAR' ? '🚗' : '🚴'}</span>
                <span style={{ color: '#64748B' }}>{d.name.split(' ')[0]} · offline</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
          {currentStrategy && (
            <div className="strategy-card px-3 py-2.5">
              <div className="text-label mb-1">Dispatch Strategy</div>
              <div className="text-[13px] font-extrabold mb-1" style={{ color: '#0F172A' }}>
                {currentStrategy.label}
              </div>
              <div className="text-[11px] mb-2" style={{ color: '#475569' }}>
                Scoring factors
              </div>
              <div className="flex flex-wrap gap-1.5">
                {strategyWeights.map(w => (
                  <span key={w.label} className="weight-chip">
                    {w.label} {w.weight}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="clay-card-sm" style={{ padding: '10px 12px', maxHeight: 180 }}>
            <div className="text-label px-0.5 mb-1">Active Orders</div>
            {activeOrders.length === 0 ? (
              <div className="py-3 text-center" style={{ maxHeight: 90 }}>
                <div className="text-[12px] font-extrabold" style={{ color: '#0F172A' }}>No active orders</div>
                <div className="text-[11px] mt-1" style={{ color: '#64748B' }}>Waiting for marketplace demand.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 130 }}>
                {activeOrders.slice(0, 4).map(o => (
                  <div key={o.id} className="clay-stat-tile px-2.5 py-2">
                    <div className="text-[11px] font-bold truncate" style={{ color: '#0F172A' }}>{o.customerName}</div>
                    <div className="text-[10px] truncate" style={{ color: '#64748B' }}>
                      {o.restaurantName} · {(o.status === 'CREATED' || o.status === 'FINDING_DRIVER') ? 'Matching' : o.status.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
