import React, { useMemo } from 'react';
import { ROAD_NODES } from '../../data/cityMap';
import type { Driver, Order } from '../../types';

interface Props { drivers: Driver[]; orders: Order[]; }

const ActiveRoutes: React.FC<Props> = ({ drivers }) => {
  const nodeMap = useMemo(() => new Map(ROAD_NODES.map((n) => [n.id, n])), []);
  const active = drivers.filter(
    (d) => d.route.length > 0 && (d.status === 'EN_ROUTE_PICKUP' || d.status === 'DELIVERING')
  );

  return (
    <>
      {active.map((driver) => {
        const rem = driver.route.slice(driver.routeIndex);
        if (rem.length < 2) return null;
        const pts = rem.map((id) => { const n = nodeMap.get(id); return n ? `${n.x},${n.y}` : null; }).filter(Boolean).join(' ');
        if (!pts) return null;
        const rr = Boolean(driver.reroutingUntilTick) || driver.statusDetail === 'Recalculating route';
        const color = rr ? '#EF4444' : driver.status === 'DELIVERING' ? '#22C55E' : '#F97316';
        return (
          <g key={driver.id}>
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
            <polyline points={pts} fill="none" stroke={color}
              strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
              opacity={0.9}
              style={{
                filter: rr
                  ? 'drop-shadow(0 0 8px rgba(239,68,68,0.25))'
                  : driver.status === 'DELIVERING'
                  ? 'drop-shadow(0 0 8px rgba(34,197,94,0.25))'
                  : 'drop-shadow(0 0 8px rgba(249,115,22,0.25))',
              }}
              className={rr ? 'incident-pulse' : 'route-animated'} />
          </g>
        );
      })}
    </>
  );
};

export default React.memo(ActiveRoutes);
