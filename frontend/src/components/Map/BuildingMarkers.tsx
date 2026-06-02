import React, { useMemo } from 'react';
import type { Building } from '../../data/cityMap';
import type { Order } from '../../types';

interface Props {
  buildings: Building[];
  orders: Order[];
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string | null) => void;
}

const BUILDING_COLORS: Record<string, string> = {
  restaurant: '#B86B4A',
  house: '#6B8F6E',
  apartment: '#6B8F6E',
  office: '#6E8094',
  shop: '#C4923A',
  park: '#6B8F6E',
};

const BuildingMarkers: React.FC<Props> = ({ buildings, orders, selectedBuildingId, onSelectBuilding }) => {
  const pendingCountByNode = useMemo(() => {
    const counts = new Map<string, { pending: number; delayed: number }>();
    for (const order of orders) {
      const cur = counts.get(order.restaurantNodeId) ?? { pending: 0, delayed: 0 };
      if (order.status === 'CREATED' || order.status === 'FINDING_DRIVER')
        counts.set(order.restaurantNodeId, { ...cur, pending: cur.pending + 1 });
      else if (order.status === 'DELAYED')
        counts.set(order.restaurantNodeId, { ...cur, delayed: cur.delayed + 1 });
    }
    return counts;
  }, [orders]);

  return (
    <>
      {buildings.map((building) => {
        const color = BUILDING_COLORS[building.type] || '#9A948A';
        const isR = building.type === 'restaurant';
        const sz = isR ? 42 : 34;
        const sel = building.id === selectedBuildingId;
        const nc = pendingCountByNode.get(building.nodeId) ?? { pending: 0, delayed: 0 };

        return (
          <g key={building.id} style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelectBuilding(sel ? null : building.id); }}>
            {sel && (
              <rect x={building.x - sz / 2 - 5} y={building.y - sz / 2 - 5}
                width={sz + 10} height={sz + 10} rx={14}
                fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
            )}
            {/* Clay tile — raised */}
            <rect x={building.x - sz / 2} y={building.y - sz / 2}
              width={sz} height={sz} rx={11}
              fill="#FFFFFF" stroke={color} strokeWidth={2.5}
              style={{ filter: 'drop-shadow(0 6px 14px rgba(15,23,42,0.12))' }} />
            <text x={building.x} y={building.y + 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={isR ? 20 : 16} style={{ pointerEvents: 'none' }}>
              {building.icon}
            </text>
            {isR && nc.pending > 0 && (
              <>
                <circle cx={building.x + sz / 2 - 2} cy={building.y - sz / 2 + 2}
                  r={8} fill="#B86B4A" stroke="#E8E3DA" strokeWidth={2} />
                <text x={building.x + sz / 2 - 2} y={building.y - sz / 2 + 2.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill="white" fontFamily="Inter, system-ui" fontWeight={700}
                  style={{ pointerEvents: 'none' }}>{nc.pending}</text>
              </>
            )}
            {isR && nc.delayed > 0 && (
              <>
                <circle cx={building.x - sz / 2 + 2} cy={building.y - sz / 2 + 2}
                  r={7} fill="#C46B58" stroke="#E8E3DA" strokeWidth={1.5} />
                <text x={building.x - sz / 2 + 2} y={building.y - sz / 2 + 2.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill="white" fontFamily="Inter, system-ui" fontWeight={700}
                  style={{ pointerEvents: 'none' }}>!</text>
              </>
            )}
            {(isR || sel) && (
              <>
                <text x={building.x} y={building.y + sz / 2 + 14}
                  textAnchor="middle" fontSize={isR ? 10 : 9}
                  fill="#E8E3DA" fontFamily="Inter, system-ui" fontWeight={800}
                  stroke="#E8E3DA" strokeWidth={3} strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}>{building.name}</text>
                <text x={building.x} y={building.y + sz / 2 + 14}
                  textAnchor="middle" fontSize={isR ? 10 : 9}
                  fill="#3A3630" fontFamily="Inter, system-ui" fontWeight={800}
                  style={{ pointerEvents: 'none' }}>{building.name}</text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
};

export default React.memo(BuildingMarkers);
