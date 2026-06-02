import React from 'react';
import type { CityZone } from '../../data/cityMap';
import type { ZoneHeat } from '../../types';

interface Props { zones: CityZone[]; heats: ZoneHeat[]; }

const ZONE_STYLES: Record<string, { fill: string; border: string; text: string }> = {
  'Capitol Heights': { fill: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.24)',  text: '#15803D' },
  'University Row':  { fill: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.24)', text: '#6D28D9' },
  Downtown:          { fill: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.24)', text: '#EA580C' },
  'Harbor Point':    { fill: 'rgba(14,165,233,0.10)', border: 'rgba(14,165,233,0.24)', text: '#0284C7' },
  'Market District': { fill: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.24)', text: '#D97706' },
  'Stadium District':{ fill: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.20)', text: '#DB2777' },
};

const ZoneOverlays: React.FC<Props> = ({ zones, heats }) => {
  const heatMap = new Map(heats.map((h) => [h.zoneName, h]));

  return (
    <>
      {zones.map((zone) => {
        const heat = heatMap.get(zone.name);
        const isHot = heat && (heat.intensity === 'HIGH' || heat.intensity === 'SURGE');
        const s = ZONE_STYLES[zone.name] || { fill: 'rgba(100,116,139,0.04)', border: 'rgba(100,116,139,0.12)', text: '#64748B' };
        const ly = zone.centerY - zone.radius + 14;
        const lx = zone.centerX;

        return (
          <g key={zone.id}>
            <circle cx={zone.centerX} cy={zone.centerY} r={zone.radius} fill={s.fill} />
            <circle cx={zone.centerX} cy={zone.centerY} r={zone.radius}
              fill="none" stroke={s.border}
              strokeWidth={isHot ? 1.2 : 0.6}
              strokeDasharray={isHot ? 'none' : '6 4'} />

            <rect x={lx - zone.name.length * 4.5} y={ly - 9}
              width={zone.name.length * 9} height={18} rx={6}
              fill="rgba(255,255,255,0.82)" stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.8}
              style={{ color: s.text, filter: 'drop-shadow(0 4px 10px rgba(15,23,42,0.06))' }} />
            <text x={lx} y={ly + 4}
              textAnchor="middle" fontSize={10} fontWeight={800}
              fill={s.text} fontFamily="Inter, system-ui"
              letterSpacing="0.06em"
              style={{ textTransform: 'uppercase' } as React.CSSProperties}>
              {zone.name}
            </text>

            {isHot && heat && (
              <text
                x={lx + zone.name.length * 4.5 + 18}
                y={ly + 3}
                textAnchor="middle" fontSize={8} fontWeight={700}
                fill={heat.intensity === 'SURGE' ? '#EF4444' : '#F59E0B'}
                fontFamily="Inter, system-ui">
                🔥
              </text>
            )}
          </g>
        );
      })}
    </>
  );
};

export default React.memo(ZoneOverlays);
