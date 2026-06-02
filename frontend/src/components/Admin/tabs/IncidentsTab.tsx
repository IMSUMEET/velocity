import { usePlatformStore } from '../../../store/platformStore';
import { api } from '../../../services/api';

const SEV_ORDER  = ['SEV-1', 'SEV-2', 'SEV-3'];
const SEV_COLORS: Record<string, string> = {
  'SEV-1': '#C46B58',
  'SEV-2': '#C4923A',
  'SEV-3': '#0EA5E9',
};
const SEV_ICONS: Record<string, string> = {
  'SEV-1': '🔴',
  'SEV-2': '🟡',
  'SEV-3': '🔵',
};

export default function IncidentsTab() {
  const incidents  = usePlatformStore(s => s.incidents);
  const simulation = usePlatformStore(s => s.simulation);

  const sorted = [...incidents].sort((a, b) => {
    const ai = SEV_ORDER.indexOf(a.severity);
    const bi = SEV_ORDER.indexOf(b.severity);
    if (ai !== bi) return ai - bi;
    return b.timestamp - a.timestamp;
  });

  const activeCount   = incidents.filter(i => !i.resolved).length;
  const resolvedCount = incidents.filter(i => i.resolved).length;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Summary bar ── */}
      <div
        className="clay-card-sm flex items-center gap-4 px-5 py-3"
        style={{ borderRadius: 16 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: activeCount > 0 ? '#C46B58' : '#28B86A',
              boxShadow: `0 0 6px ${activeCount > 0 ? 'rgba(249,115,96,0.6)' : 'rgba(34,197,94,0.5)'}`,
              animation: activeCount > 0 ? 'incident-pulse 0.85s ease-in-out infinite' : 'none',
            }}
          />
          <span className="text-[12px] font-bold" style={{ color: '#1A3550' }}>
            {activeCount} active incident{activeCount !== 1 ? 's' : ''}
          </span>
        </div>
        {resolvedCount > 0 && (
          <span className="text-[11px]" style={{ color: '#6A8FA8' }}>
            · {resolvedCount} resolved
          </span>
        )}
        <div className="ml-auto text-[11px]" style={{ color: '#6A8FA8' }}>
          Tick #{simulation.tickCount}
        </div>
      </div>

      {/* ── Incidents grid ── */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(inc => {
            const color     = SEV_COLORS[inc.severity] ?? '#6A8FA8';
            const icon      = SEV_ICONS[inc.severity] ?? '⚪';
            const remaining = Math.max(0, inc.startTick + inc.durationTicks - simulation.tickCount);
            const pct       = Math.max(0, Math.min(100, (remaining / inc.durationTicks) * 100));

            return (
              <div
                key={inc.id}
                className="float-in-up"
                style={{
                  background: inc.resolved
                    ? 'linear-gradient(148deg, #D4E8F6 0%, #A8CCE6 100%)'
                    : 'linear-gradient(148deg, #F4FAFF 0%, #E3F0FA 48%, #CFE4F4 100%)',
                  border: `1px solid ${inc.resolved ? 'rgba(30,70,110,0.12)' : color + '35'}`,
                  borderTopColor: inc.resolved ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.60)',
                  borderLeftColor: inc.resolved ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.60)',
                  borderRadius: 20,
                  boxShadow: inc.resolved
                    ? 'inset 3px 3px 8px rgba(25,55,90,0.14), inset -2px -2px 6px rgba(255,255,255,0.50)'
                    : '10px 10px 22px rgba(25,55,90,0.26), -8px -8px 18px rgba(255,255,255,0.82), inset 1px 1px 1px rgba(255,255,255,0.70)',
                  padding: '16px',
                  opacity: inc.resolved ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: color + '14' }}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase"
                          style={{ background: color + '18', color }}
                        >
                          {inc.severity}
                        </span>
                        {inc.mitigated && !inc.resolved && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#28B86A' }}
                          >
                            Mitigated
                          </span>
                        )}
                        {inc.resolved && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#28B86A' }}
                          >
                            ✓ Resolved
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] font-bold mt-1" style={{ color: '#1A3550' }}>
                        {inc.title}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="text-[11px] leading-relaxed mb-3" style={{ color: '#4A7494' }}>
                  {inc.message}
                </div>

                {/* Meta */}
                <div className="flex gap-3 flex-wrap text-[10px] mb-3" style={{ color: '#6A8FA8' }}>
                  {inc.zone && (
                    <span
                      className="px-2 py-0.5 rounded-lg"
                      style={{ background: 'rgba(100,116,139,0.07)' }}
                    >
                      📍 {inc.zone}
                    </span>
                  )}
                  {inc.affectedEdgeId && (
                    <span
                      className="px-2 py-0.5 rounded-lg font-mono"
                      style={{ background: 'rgba(100,116,139,0.07)' }}
                    >
                      Edge: {inc.affectedEdgeId}
                    </span>
                  )}
                  {!inc.resolved && (
                    <span
                      className="px-2 py-0.5 rounded-lg"
                      style={{ background: color + '12', color }}
                    >
                      ~{remaining} ticks left
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {!inc.resolved && (
                  <div
                    className="h-1.5 rounded-full overflow-hidden mb-3"
                    style={{ background: color + '14' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                )}

                {/* Resolved info */}
                {inc.resolved && inc.mitigation && (
                  <div
                    className="text-[10px] px-3 py-2 rounded-xl mb-3"
                    style={{ background: 'rgba(34,197,94,0.08)', color: '#28B86A' }}
                  >
                    ✓ {inc.mitigation}
                  </div>
                )}

                {/* Actions */}
                {!inc.resolved && (
                  <div className="flex gap-2">
                    {!inc.mitigated && (
                      <button
                        onClick={() => api.incidents.mitigate(inc.id)}
                        className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold"
                        style={{
                          background: 'rgba(245,158,11,0.10)',
                          color: '#C4923A',
                          border: '1px solid rgba(245,158,11,0.22)',
                        }}
                      >
                        Mitigate
                      </button>
                    )}
                    <button
                      onClick={() => api.incidents.resolve(inc.id)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold"
                      style={{
                        background: 'rgba(34,197,94,0.10)',
                        color: '#28B86A',
                        border: '1px solid rgba(34,197,94,0.22)',
                      }}
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {incidents.length === 0 && (
            <div
              className="col-span-2"
              style={{
                background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
                border: '1px solid rgba(255,255,255,0.88)',
                borderBottomColor: 'rgba(100,116,139,0.15)',
                borderRadius: 20,
                boxShadow: '7px 7px 20px rgba(45,38,30,0.07), -7px -7px 20px rgba(255,250,242,0.48)',
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div className="text-3xl mb-3">✅</div>
              <div className="text-[14px] font-semibold" style={{ color: '#1A3550' }}>
                All clear
              </div>
              <div className="text-[12px] mt-1" style={{ color: '#6A8FA8' }}>
                No active incidents. The system is healthy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
