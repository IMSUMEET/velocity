import { useSimulationStore } from '../../store/simulationStore';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

const SEVERITY_STYLES = {
  info: { dot: '#4D8BB8', bg: 'rgba(77,139,184,0.06)' },
  warning: { dot: '#C89B2E', bg: 'rgba(200,155,46,0.06)' },
  critical: { dot: '#C44B4B', bg: 'rgba(196,75,75,0.06)' },
} as const;

export default function RightPanel() {
  const metrics = useSimulationStore(s => s.metrics);
  const incidents = useSimulationStore(s => s.incidents);
  const incidentLog = useSimulationStore(s => s.incidentLog);
  const dispatchDecisions = useSimulationStore(s => s.dispatchDecisions);
  const drivers = useSimulationStore(s => s.drivers);

  const perc = metrics.deliveryPercentiles;
  const onBreak = drivers.filter(d => d.status === 'ON_BREAK').length;
  const idle = drivers.filter(d => d.status === 'IDLE').length;
  const total = drivers.filter(d => d.status !== 'OFFLINE').length;

  return (
    <div className="clay-card flex flex-col overflow-hidden" style={{ width: 300, borderRadius: 20, height: '100%' }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Driver Fleet */}
        <div>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#1F2933' }}>
            <span>🚗</span> Fleet Status
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="clay-inset rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-bold" style={{ color: '#4E9F5B' }}>{idle}</p>
              <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>Available</p>
            </div>
            <div className="clay-inset rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-bold" style={{ color: '#E66B2E' }}>{total - idle - onBreak}</p>
              <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>Active</p>
            </div>
            <div className="clay-inset rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-bold" style={{ color: onBreak > 0 ? '#C89B2E' : '#8A8A80' }}>{onBreak}</p>
              <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>On Break</p>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#4D8BB8' }}>
            <span>📊</span> Delivery Performance
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { label: 'P50', value: perc.p50 ? `${perc.p50}s` : '—' },
              { label: 'P95', value: perc.p95 ? `${perc.p95}s` : '—' },
              { label: 'P99', value: perc.p99 ? `${perc.p99}s` : '—' },
            ].map(m => (
              <div key={m.label} className="clay-inset rounded-xl px-2 py-2 text-center">
                <p className="text-sm font-bold" style={{ color: '#1F2933' }}>{m.value}</p>
                <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>{m.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="clay-inset rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-bold" style={{ color: '#4E9F5B' }}>{metrics.driverUtilization}%</p>
              <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>Utilization</p>
            </div>
            <div className="clay-inset rounded-xl px-2 py-2 text-center">
              <p className="text-sm font-bold" style={{ color: '#E66B2E' }}>{metrics.ordersPerMinute}/m</p>
              <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>Throughput</p>
            </div>
          </div>
        </div>

        {/* Active Incidents */}
        {incidents.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#C44B4B' }}>
              <span>🚨</span> Active Incidents ({incidents.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {incidents.slice(0, 5).map(inc => {
                const style = SEVERITY_STYLES[inc.severity];
                return (
                  <div key={inc.id} className="rounded-xl px-3 py-2 flex items-start gap-2"
                    style={{ background: style.bg }}>
                    <div className="mt-1 shrink-0" style={{ width: 6, height: 6, borderRadius: 3, background: style.dot }} />
                    <p className="text-[11px] font-medium" style={{ color: '#1F2933' }}>{inc.message}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Feed */}
        <div>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#4E9F5B' }}>
            <span>📡</span> Live Feed
          </p>
          <div className="flex flex-col gap-1">
            {incidentLog.slice(0, 12).map((entry) => {
              const style = SEVERITY_STYLES[entry.severity as keyof typeof SEVERITY_STYLES] || SEVERITY_STYLES.info;
              return (
                <div key={entry.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
                  style={{ background: style.bg }}>
                  <div className="mt-1 shrink-0" style={{ width: 4, height: 4, borderRadius: 2, background: style.dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium truncate" style={{ color: '#1F2933' }}>{entry.message}</p>
                    <p className="text-[9px]" style={{ color: '#8A8A80' }}>{timeAgo(entry.timestamp)}</p>
                  </div>
                </div>
              );
            })}
            {incidentLog.length === 0 && (
              <p className="text-[11px] text-center py-2" style={{ color: '#8A8A80' }}>Monitoring...</p>
            )}
          </div>
        </div>

        {/* Dispatch Log */}
        <div>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#E66B2E' }}>
            <span>🚀</span> Recent Dispatches
          </p>
          <div className="flex flex-col gap-1.5">
            {dispatchDecisions.slice(0, 6).map((d, i) => (
              <div key={i} className="clay-inset rounded-xl px-3 py-2">
                <p className="text-[11px] font-semibold" style={{ color: '#E66B2E' }}>
                  {d.driverName} → {d.restaurantName}
                </p>
                <p className="text-[10px]" style={{ color: '#8A8A80' }}>
                  score: {d.score.toFixed(1)} {d.scoreBreakdown ? `dist:${d.scoreBreakdown.distanceScore} eta:${d.scoreBreakdown.etaScore}` : ''}
                </p>
              </div>
            ))}
            {dispatchDecisions.length === 0 && (
              <p className="text-[11px] text-center py-2" style={{ color: '#8A8A80' }}>No dispatches yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
