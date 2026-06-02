import React, { useMemo } from 'react';
import { ROAD_NODES } from '../../data/cityMap';
import type { Driver, Order } from '../../types';

interface Props {
  drivers: Driver[];
  orders?: Order[];
  selectedDriverId: string | null;
  onSelectDriver: (id: string | null) => void;
  quietMode?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  IDLE: '#2563EB',
  EN_ROUTE_PICKUP: '#F97316',
  WAITING_AT_RESTAURANT: '#F59E0B',
  DELIVERING: '#22C55E',
  ON_BREAK: '#94A3B8',
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function formatEta(m: number) {
  if (!Number.isFinite(m) || m <= 0) return 'ETA --';
  return m < 1 ? `ETA ${Math.ceil(m * 60)}s` : `ETA ${m.toFixed(1)}m`;
}

function statusLabel(d: Driver) {
  switch (d.status) {
    case 'EN_ROUTE_PICKUP': return 'To restaurant';
    case 'WAITING_AT_RESTAURANT': return 'Waiting food';
    case 'DELIVERING': return 'To customer';
    case 'ON_BREAK': return 'On break';
    default: return 'Idle';
  }
}

function getThought(d: Driver): string | null {
  if (d.thoughtMessage) return d.thoughtMessage;
  if (d.statusDetail === 'Incentive boost active') return '⚡ Incentive boost!';
  if (d.statusDetail?.startsWith('Relocating to')) return `📍 ${d.statusDetail}`;
  if (d.status === 'WAITING_AT_RESTAURANT') return '🍳 Food not ready yet...';
  if (d.status === 'EN_ROUTE_PICKUP') return d.statusDetail ?? '🏃 Heading to restaurant';
  if (d.status === 'DELIVERING') return d.statusDetail ?? '📦 On the way to customer';
  if (d.status === 'ON_BREAK') return '😴 Need a quick break';
  return null;
}

function isRerouting(d: Driver) { return Boolean(d.reroutingUntilTick) || d.statusDetail === 'Recalculating route'; }

function ThoughtBubble({ x, y, text, urgent }: { x: number; y: number; text: string; urgent?: boolean }) {
  const display = text.length > 28 ? `${text.slice(0, 27)}…` : text;
  const w = Math.min(140, Math.max(88, display.length * 5.2 + 16));
  const by = y - 52;
  return (
    <g style={{ pointerEvents: 'none' }} className={urgent ? 'thought-bubble-pop' : undefined}>
      <rect x={x - w / 2} y={by - 14} width={w} height={22} rx={10}
        fill={urgent ? 'rgba(196,107,88,0.92)' : 'rgba(232,227,218,0.96)'}
        stroke={urgent ? '#C46B58' : 'rgba(58,52,46,0.14)'} strokeWidth={1} />
      <polygon points={`${x - 5},${by + 8} ${x + 5},${by + 8} ${x},${by + 14}`}
        fill={urgent ? 'rgba(196,107,88,0.92)' : 'rgba(232,227,218,0.96)'}
        stroke={urgent ? '#C46B58' : 'rgba(58,52,46,0.14)'} strokeWidth={0.5} />
      <text x={x} y={by + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fill={urgent ? '#fff' : '#3A3630'}
        fontFamily="Inter, system-ui" fontWeight={600}>{display}</text>
    </g>
  );
}

const TICK_MS = 500;

const Vehicles: React.FC<Props> = ({ drivers, orders = [], selectedDriverId, onSelectDriver, quietMode = false }) => {
  const nodeMap = useMemo(() => new Map(ROAD_NODES.map((n) => [n.id, n])), []);
  const activeDrivers = drivers.filter((d) => d.status !== 'OFFLINE');
  const carryingByDriver = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.driverId && (o.status === 'PICKED_UP' || o.status === 'EN_ROUTE_DELIVERY'))
        map.set(o.driverId, (map.get(o.driverId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  return (
    <>
      {activeDrivers.map((driver) => {
        const cn = nodeMap.get(driver.currentNodeId);
        if (!cn) return null;
        let x = cn.x, y = cn.y;
        if (driver.targetNodeId) {
          const tn = nodeMap.get(driver.targetNodeId);
          if (tn) { x = lerp(cn.x, tn.x, driver.progress); y = lerp(cn.y, tn.y, driver.progress); }
        } else if (driver.route?.length > 1 && driver.routeIndex < driver.route.length - 1) {
          const fn = nodeMap.get(driver.route[driver.routeIndex]);
          const tn = nodeMap.get(driver.route[driver.routeIndex + 1]);
          if (fn && tn) { x = lerp(fn.x, tn.x, driver.progress); y = lerp(fn.y, tn.y, driver.progress); }
        }

        const isCar = driver.vehicleType === 'CAR';
        const sc = STATUS_COLORS[driver.status] || '#9A948A';
        const sel = driver.id === selectedDriverId;
        const active = ['EN_ROUTE_PICKUP', 'DELIVERING', 'WAITING_AT_RESTAURANT'].includes(driver.status);
        const rr = isRerouting(driver);
        const thought = getThought(driver);
        const rem = driver.route.slice(driver.routeIndex);
        const eta = rem.length > 1 ? (rem.length - 1) * 0.9 / Math.max(driver.speed, 0.2) : 0;
        const story = rr || driver.status === 'WAITING_AT_RESTAURANT';
        const show = sel || !quietMode || story;

        return (
          <g key={driver.id} transform={`translate(${x},${y})`}
            style={{ transition: active ? `transform ${TICK_MS}ms linear` : 'transform 200ms ease-out' }}>
            <g className={active ? 'vehicle-active' : undefined} style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSelectDriver(sel ? null : driver.id); }}>

              {rr && (
                <>
                  <circle cx={0} cy={0} r={32} fill="none" stroke="#C46B58" strokeWidth={2} opacity={0.3} className="reroute-glow-outer" />
                  <circle cx={0} cy={0} r={24} fill="#C46B58" opacity={0.08} className="reroute-glow-inner" />
                  <circle cx={0} cy={0} r={18} fill="none" stroke="#C46B58" strokeWidth={2} opacity={0.6} className="reroute-glow-ring" />
                </>
              )}
              {sel && (
                <>
                  <circle cx={0} cy={0} r={27} fill={sc} opacity={0.14} />
                  <circle cx={0} cy={0} r={31} fill="none" stroke="#2563EB" strokeWidth={3} opacity={0.18} />
                  <circle cx={0} cy={0} r={34} fill="none" stroke="#2563EB" strokeWidth={4} opacity={0.12} />
                </>
              )}

              {/* Raised circle */}
              <circle cx={0} cy={0} r={20}
                fill="#FFFFFF"
                stroke={rr ? '#EF4444' : sc}
                strokeWidth={rr ? 3 : sel ? 2.5 : 2}
                style={{ filter: 'drop-shadow(0 8px 18px rgba(15,23,42,0.18))' }} />

              <text x={0} y={6} textAnchor="middle" fontSize={18}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {isCar ? '🚗' : '🚴'}
              </text>

              {(carryingByDriver.get(driver.id) ?? 0) > 0 && (
                <>
                  <circle cx={-14} cy={-14} r={8} fill="#B86B4A" stroke="#E8E3DA" strokeWidth={1.5} />
                  <text x={-14} y={-13.5} textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fill="#fff" fontFamily="Inter, system-ui" fontWeight={800}
                    style={{ pointerEvents: 'none' }}>{carryingByDriver.get(driver.id)}</text>
                </>
              )}

              {thought && (sel || story || !quietMode) && (
                <ThoughtBubble x={0} y={0} text={thought} urgent={rr} />
              )}

              {/* Name */}
              <text x={0} y={-23} textAnchor="middle" fontSize={10}
                fill="#E8E3DA" fontFamily="Inter, system-ui" fontWeight={800}
                stroke="#E8E3DA" strokeWidth={3} strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}>{driver.name.split(' ')[0]}</text>
              <text x={0} y={-23} textAnchor="middle" fontSize={10}
                fill="#0F172A" fontFamily="Inter, system-ui" fontWeight={800}
                style={{ pointerEvents: 'none' }}>{driver.name.split(' ')[0]}</text>

              {show && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={-38} y={17} width={76} height={17} rx={8}
                    fill="rgba(248,250,252,0.92)"
                    stroke={rr ? '#C46B58' : sc} strokeWidth={0.8} />
                  <text x={0} y={28} textAnchor="middle" fontSize={9}
                    fill="#3A3630" fontFamily="Inter, system-ui" fontWeight={700}>
                    {rr ? 'Detour' : statusLabel(driver)}</text>
                </g>
              )}
              {show && active && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={-28} y={36} width={56} height={14} rx={7}
                    fill="rgba(248,250,252,0.85)" />
                  <text x={0} y={45.5} textAnchor="middle" fontSize={8}
                    fill="#7A746A" fontFamily="Inter, system-ui" fontWeight={600}>{formatEta(eta)}</text>
                </g>
              )}

              {(quietMode && !sel || (!quietMode || sel) && active) && (
                <circle cx={12} cy={-12} r={4} fill={rr ? '#C46B58' : sc} stroke="#fff" strokeWidth={1.5} />
              )}
            </g>
          </g>
        );
      })}
    </>
  );
};

export default React.memo(Vehicles);
