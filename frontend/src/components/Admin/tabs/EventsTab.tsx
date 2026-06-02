import { usePlatformStore } from '../../../store/platformStore';

const SEV_COLORS: Record<string, string> = {
  critical: '#C46B58',
  warning:  '#C4923A',
  info:     '#0EA5E9',
};

const SEV_BG: Record<string, string> = {
  critical: 'rgba(249,115,96,0.10)',
  warning:  'rgba(245,158,11,0.10)',
  info:     'rgba(59,111,245,0.08)',
};

const CATEGORY_ICON: Record<string, string> = {
  ORDER:    '📦',
  DRIVER:   '🚗',
  INCIDENT: '⚠️',
  DISPATCH: '⚡',
  SYSTEM:   '⚙️',
};

export default function EventsTab() {
  const { recentEvents, queues } = usePlatformStore();

  return (
    <div className="flex gap-3 h-full">

      {/* ── Events feed ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="text-[14px] font-bold" style={{ color: '#1A3550' }}>Live Event Feed</div>
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
            style={{
              background: 'rgba(34,197,94,0.10)',
              color: '#28B86A',
              border: '1px solid rgba(34,197,94,0.22)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#28B86A',
                animation: 'live-pulse 1.8s ease-in-out infinite',
              }}
            />
            {recentEvents.length} events
          </div>
        </div>

        <div className="flex-1 overflow-auto clay-card">
          <div className="flex flex-col">
            {recentEvents.slice(0, 80).map((e, i) => {
              const col    = SEV_COLORS[e.severity] ?? '#6A8FA8';
              const bg     = SEV_BG[e.severity]    ?? 'transparent';
              const catIcon = CATEGORY_ICON[e.category] ?? '•';
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    borderBottom: '1px solid rgba(223,228,234,0.45)',
                    background: i === 0 ? bg : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Severity dot */}
                  <div className="flex flex-col items-center pt-1 flex-shrink-0" style={{ width: 18 }}>
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: col }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: '#1A3550' }}>
                      {catIcon} {e.message}
                    </div>
                    <div className="flex gap-2.5 mt-0.5 flex-wrap">
                      <span
                        className="text-[9px] font-mono"
                        style={{ color: '#6A8FA8' }}
                      >
                        tick #{e.tick}
                      </span>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-px rounded-full"
                        style={{ background: col + '14', color: col }}
                      >
                        {e.type}
                      </span>
                      <span className="text-[9px]" style={{ color: '#94C4E0' }}>
                        {e.category}
                      </span>
                      {e.orderId && (
                        <span className="text-[9px] font-mono" style={{ color: '#6A8FA8' }}>
                          order:{e.orderId}
                        </span>
                      )}
                      {e.driverId && (
                        <span className="text-[9px] font-mono" style={{ color: '#6A8FA8' }}>
                          driver:{e.driverId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {recentEvents.length === 0 && (
              <div className="text-center py-16 text-[13px]" style={{ color: '#6A8FA8' }}>
                No events yet. Start the stream to see live events.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Queue metrics ── */}
      <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: 300 }}>
        <div className="text-[14px] font-bold" style={{ color: '#1A3550' }}>Queue Metrics</div>

        {queues.length === 0 && (
          <div
            style={{
              background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
              border: '1px solid rgba(255,255,255,0.88)',
              borderBottomColor: 'rgba(100,116,139,0.15)',
              borderRadius: 20,
              boxShadow: '6px 6px 16px rgba(45,38,30,0.07), -6px -6px 16px rgba(255,250,242,0.48)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div className="text-[12px]" style={{ color: '#6A8FA8' }}>
              No queue data yet.
            </div>
          </div>
        )}

        {queues.map(q => {
          const healthColor = q.health === 'healthy'
            ? '#28B86A'
            : q.health === 'backpressure'
            ? '#C4923A'
            : '#C46B58';
          const fillPct = Math.min(100, (q.depth / Math.max(1, q.workers * 6)) * 100);

          return (
            <div
              key={q.name}
              style={{
                background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
                border: '1px solid rgba(255,255,255,0.88)',
                borderBottomColor: 'rgba(100,116,139,0.15)',
                borderRightColor: 'rgba(100,116,139,0.12)',
                borderRadius: 20,
                boxShadow: '6px 6px 16px rgba(45,38,30,0.07), -6px -6px 16px rgba(255,250,242,0.48)',
                padding: '16px',
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-bold" style={{ color: '#1A3550' }}>
                  {q.name}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: healthColor + '18', color: healthColor }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: healthColor }}
                  />
                  {q.health}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Depth',   value: q.depth,              color: q.depth > q.workers * 4 ? '#C46B58' : '#1A3550' },
                  { label: 'Workers', value: q.workers,            color: '#1A3550' },
                  { label: 'In',      value: `${q.ingestRate}/s`,  color: '#0EA5E9' },
                  { label: 'Out',     value: `${q.consumeRate}/s`, color: '#28B86A' },
                  { label: 'Lag',     value: q.consumerLag,        color: q.consumerLag > 100 ? '#C46B58' : '#1A3550' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl px-3 py-2"
                    style={{ background: 'rgba(238,243,247,0.6)' }}
                  >
                    <div className="text-[9px] font-semibold mb-0.5" style={{ color: '#6A8FA8' }}>
                      {label}
                    </div>
                    <div className="text-[14px] font-extrabold" style={{ color }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fill bar */}
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: healthColor + '14' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${fillPct}%`, background: healthColor }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[9px]" style={{ color: '#6A8FA8' }}>
                <span>0</span>
                <span>{fillPct.toFixed(0)}% full</span>
                <span>{q.workers * 6}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
