import React from 'react';

interface MetroStation {
  id: string;
  name: string;
  x: number;
  y: number;
}

const METRO_STATIONS: MetroStation[] = [
  { id: 'ms-1', name: 'Market Stn', x: 220, y: 350 },
  { id: 'ms-2', name: 'Capitol Stn', x: 430, y: 230 },
  { id: 'ms-3', name: 'Central Stn', x: 560, y: 420 },
  { id: 'ms-4', name: 'East Stn', x: 750, y: 300 },
  { id: 'ms-5', name: 'University Stn', x: 900, y: 220 },
];

const METRO_LINE_2: MetroStation[] = [
  { id: 'ms-6', name: 'Stadium Stn', x: 250, y: 640 },
  { id: 'ms-7', name: 'South Central', x: 400, y: 500 },
  { id: 'ms-3b', name: '', x: 560, y: 420 },
  { id: 'ms-8', name: 'Harbor Stn', x: 780, y: 610 },
];

function buildPath(stations: MetroStation[]): string {
  if (stations.length < 2) return '';
  let d = `M ${stations[0].x} ${stations[0].y}`;
  for (let i = 1; i < stations.length; i++) {
    const prev = stations[i - 1];
    const curr = stations[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = Math.min(prev.y, curr.y) - 15;
    d += ` Q ${cpx} ${cpy} ${curr.x} ${curr.y}`;
  }
  return d;
}

const TransitLayer: React.FC = () => {
  const path1 = buildPath(METRO_STATIONS);
  const path2 = buildPath(METRO_LINE_2);

  return (
    <g id="layer-transit" opacity={0.9}>
      {/* Metro Line 1 (Blue) — Market to University */}
      <path d={path1} fill="none" stroke="#1E3A5F" strokeWidth={6} strokeLinecap="round" />
      <path d={path1} fill="none" stroke="#3B82F6" strokeWidth={3} strokeLinecap="round" />
      <path d={path1} fill="none" stroke="#60A5FA" strokeWidth={1} strokeDasharray="2 8" strokeLinecap="round" opacity={0.6} />

      {/* Metro Line 2 (Orange) — Stadium to Harbor */}
      <path d={path2} fill="none" stroke="#5C2D0E" strokeWidth={6} strokeLinecap="round" />
      <path d={path2} fill="none" stroke="#B86B4A" strokeWidth={3} strokeLinecap="round" />
      <path d={path2} fill="none" stroke="#FB923C" strokeWidth={1} strokeDasharray="2 8" strokeLinecap="round" opacity={0.6} />

      {/* Stations — Line 1 */}
      {METRO_STATIONS.map(stn => (
        <g key={stn.id}>
          <circle cx={stn.x} cy={stn.y} r={7} fill="#0F172A" stroke="#3B82F6" strokeWidth={2} />
          <circle cx={stn.x} cy={stn.y} r={3} fill="#60A5FA" />
          {stn.name && (
            <>
              <rect
                x={stn.x - stn.name.length * 3 - 4}
                y={stn.y + 10}
                width={stn.name.length * 6 + 8}
                height={12}
                rx={3}
                fill="#0F172ACC"
              />
              <text
                x={stn.x} y={stn.y + 20}
                textAnchor="middle" fontSize={8} fontWeight={700}
                fill="#93C5FD"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {stn.name}
              </text>
            </>
          )}
        </g>
      ))}

      {/* Stations — Line 2 */}
      {METRO_LINE_2.filter(s => s.name).map(stn => (
        <g key={stn.id}>
          <circle cx={stn.x} cy={stn.y} r={7} fill="#0F172A" stroke="#B86B4A" strokeWidth={2} />
          <circle cx={stn.x} cy={stn.y} r={3} fill="#FB923C" />
          {stn.name && (
            <>
              <rect
                x={stn.x - stn.name.length * 3 - 4}
                y={stn.y + 10}
                width={stn.name.length * 6 + 8}
                height={12}
                rx={3}
                fill="#0F172ACC"
              />
              <text
                x={stn.x} y={stn.y + 20}
                textAnchor="middle" fontSize={8} fontWeight={700}
                fill="#FDBA74"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {stn.name}
              </text>
            </>
          )}
        </g>
      ))}

      {/* Transfer indicator at Central Station */}
      <circle cx={560} cy={420} r={10} fill="none" stroke="#FAFAFA" strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />

      {/* Legend */}
      <g transform="translate(80, 745)">
        <rect x={0} y={-8} width={200} height={18} rx={4} fill="#09090BCC" />
        <line x1={6} y1={0} x2={26} y2={0} stroke="#3B82F6" strokeWidth={3} strokeLinecap="round" />
        <text x={30} y={3} fontSize={7} fill="#93C5FD" fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>Line 1 — Blue</text>
        <line x1={100} y1={0} x2={120} y2={0} stroke="#B86B4A" strokeWidth={3} strokeLinecap="round" />
        <text x={124} y={3} fontSize={7} fill="#FDBA74" fontFamily="Inter, system-ui, sans-serif" fontWeight={600}>Line 2 — Orange</text>
      </g>
    </g>
  );
};

export default React.memo(TransitLayer);
