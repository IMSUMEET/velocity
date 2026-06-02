import React, { useMemo } from 'react';
import type { RoadNode, RoadEdge } from '../../data/cityMap';
import type { Incident } from '../../types';

interface Props { nodes: RoadNode[]; edges: RoadEdge[]; incidents?: Incident[]; }

const Roads: React.FC<Props> = ({ nodes, edges, incidents = [] }) => {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const accidentEdgeIds = useMemo(
    () => new Set(incidents.filter((i) => i.type === 'accident' && i.affectedEdgeId).map((i) => i.affectedEdgeId as string)),
    [incidents]
  );
  const jamZones = useMemo(
    () => new Set(incidents.filter((i) => i.type === 'traffic_jam' && i.zone).map((i) => i.zone as string)),
    [incidents]
  );
  const namedNodes = useMemo(() => nodes.filter(n => n.name), [nodes]);
  const connectionCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of edges) { c.set(e.from, (c.get(e.from) ?? 0) + 1); c.set(e.to, (c.get(e.to) ?? 0) + 1); }
    return c;
  }, [edges]);

  return (
    <>
      {edges.map((e) => {
        const f = nodeMap.get(e.from), t = nodeMap.get(e.to);
        if (!f || !t) return null;
        return <line key={`c-${e.id}`} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke="rgba(71,85,105,0.28)" strokeWidth={e.isMajor ? 13 : 6.5} strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.12))' }} />;
      })}
      {edges.map((e) => {
        const f = nodeMap.get(e.from), t = nodeMap.get(e.to);
        if (!f || !t) return null;
        return <line key={`s-${e.id}`} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke="#FFFFFF" strokeWidth={e.isMajor ? 8.5 : 4.5} strokeLinecap="round" />;
      })}
      {edges.filter(e => e.isMajor).map((e) => {
        const f = nodeMap.get(e.from), t = nodeMap.get(e.to);
        if (!f || !t) return null;
        return <line key={`l-${e.id}`} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke="rgba(100,116,139,0.30)" strokeWidth={1} strokeDasharray="8 6" strokeLinecap="round" />;
      })}
      {edges.map((e) => {
        const f = nodeMap.get(e.from), t = nodeMap.get(e.to);
        if (!f || !t) return null;
        const jam = jamZones.has(f.zone) || jamZones.has(t.zone);
        const acc = accidentEdgeIds.has(e.id);
        if (!jam && !acc) return null;
        return <line key={`i-${e.id}`} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke={acc ? '#EF4444' : '#F59E0B'} strokeWidth={acc ? 4.5 : 3} strokeLinecap="round"
          opacity={acc ? 0.75 : 0.45} className={acc ? 'incident-pulse' : undefined} />;
      })}
      {nodes.map((n) => {
        const cnt = connectionCount.get(n.id) ?? 0;
        const major = n.name && cnt >= 3;
        return <circle key={`n-${n.id}`} cx={n.x} cy={n.y}
          r={major ? 4 : n.name ? 2.5 : 1.5}
          fill={major ? '#FFFFFF' : 'rgba(100,116,139,0.25)'}
          stroke={major ? 'rgba(71,85,105,0.18)' : 'none'} strokeWidth={1} />;
      })}
      {namedNodes.map((n) => {
        if ((connectionCount.get(n.id) ?? 0) < 3) return null;
        return (
          <g key={`sig-${n.id}`}>
            <rect x={n.x + 7} y={n.y - 13} width={5} height={14} rx={2}
              fill="#475569" stroke="rgba(71,85,105,0.20)" strokeWidth={0.5} />
            <circle cx={n.x + 9.5} cy={n.y - 9} r={1.6} fill="#F97316" opacity={0.85} />
            <circle cx={n.x + 9.5} cy={n.y - 3.5} r={1.6} fill="#22C55E" opacity={0.55} />
          </g>
        );
      })}
    </>
  );
};

export default React.memo(Roads);
