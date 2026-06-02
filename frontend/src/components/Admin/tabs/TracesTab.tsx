import { usePlatformStore, type OrderTrace } from '../../../store/platformStore';
import { api } from '../../../services/api';
import { useState, useEffect } from 'react';

const SVC_COLORS: Record<string, string> = {
  'order-service':   '#7DD3FC',
  'dispatch-engine': '#0EA5E9',
  'driver-runtime':  '#28B86A',
  'restaurant':      '#14B8A6',
};

const STATUS_COLORS: Record<string, string> = {
  DELIVERED:         '#28B86A',
  EN_ROUTE_DELIVERY: '#0EA5E9',
  PICKED_UP:         '#0EA5E9',
  WAITING_FOR_FOOD:  '#14B8A6',
  EN_ROUTE_PICKUP:   '#38BDF8',
  FINDING_DRIVER:    '#7DD3FC',
  CREATED:           '#6A8FA8',
  DELAYED:           '#F59E0B',
};

export default function TracesTab() {
  const orders = usePlatformStore(s => s.orders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trace, setTrace] = useState<OrderTrace | null>(null);

  useEffect(() => {
    if (!selectedOrderId) { setTrace(null); return; }
    api.traces.get(selectedOrderId).then(setTrace).catch(() => setTrace(null));
  }, [selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) return;
    const iv = setInterval(() => {
      api.traces.get(selectedOrderId).then(setTrace).catch(() => {});
    }, 2000);
    return () => clearInterval(iv);
  }, [selectedOrderId]);

  const recentOrders = [...orders]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40);

  return (
    <div className="flex gap-3 h-full">

      {/* ── Order picker ── */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-shrink-0 clay-card-sm" style={{ width: 240, padding: '14px 10px' }}>
        <div className="text-[11px] font-bold px-2 mb-1" style={{ color: '#1A3550' }}>
          Select Order
        </div>
        <div className="text-[9.5px] font-medium px-2 mb-2" style={{ color: '#6A8FA8' }}>
          {recentOrders.length} recent orders
        </div>

        {recentOrders.map(o => {
          const active    = selectedOrderId === o.id;
          const statusCol = STATUS_COLORS[o.status] ?? '#6A8FA8';
          return (
            <button
              key={o.id}
              onClick={() => setSelectedOrderId(o.id)}
              className={`w-full text-left px-3 py-2.5 transition-all ${active ? 'fleet-card-active' : 'fleet-card'}`}
              style={{
                borderRadius: 14,
                borderLeft: active ? `3px solid ${statusCol}` : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span
                  className="font-mono font-bold text-[11px]"
                  style={{ color: active ? '#0EA5E9' : '#1A3550' }}
                >
                  #{o.id}
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusCol }} />
              </div>
              <div className="text-[10px] truncate" style={{ color: '#4A7494' }}>
                {o.restaurantName}
              </div>
              <div className="text-[10px] truncate" style={{ color: '#6A8FA8' }}>
                → {o.customerName}
              </div>
              <div className="text-[9px] mt-0.5 font-semibold" style={{ color: statusCol }}>
                {o.status.replace(/_/g, ' ').toLowerCase()}
              </div>
            </button>
          );
        })}

        {recentOrders.length === 0 && (
          <div className="text-center py-8 text-[11px]" style={{ color: '#6A8FA8' }}>
            No orders yet. Start the stream.
          </div>
        )}
      </div>

      {/* ── Trace waterfall ── */}
      <div className="flex-1 min-w-0">
        {trace ? (
          <div className="flex flex-col gap-3 h-full clay-card" style={{ padding: 20, overflow: 'auto' }}>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[15px] font-bold" style={{ color: '#1A3550' }}>
                  Trace: <span className="font-mono">{trace.traceId}</span>
                </div>
                <div className="text-[11px] mt-1" style={{ color: '#6A8FA8' }}>
                  Order: <span className="font-mono font-semibold" style={{ color: '#4A7494' }}>#{trace.orderId}</span>
                  {' '}· Status:{' '}
                  <span className="font-semibold" style={{ color: STATUS_COLORS[trace.currentStatus] ?? '#6A8FA8' }}>
                    {trace.currentStatus?.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Service legend */}
            <div className="flex gap-2 flex-wrap">
              {Object.entries(SVC_COLORS).map(([svc, color]) => (
                <div
                  key={svc}
                  className="clay-pill flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold"
                  style={{ color, background: `linear-gradient(148deg, ${color}18 0%, ${color}10 100%)` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  {svc}
                </div>
              ))}
            </div>

            {/* Waterfall */}
            <div className="clay-inset rounded-2xl p-4 flex flex-col gap-2">
              {trace.spans.map(span => {
                const maxOffset = Math.max(1, ...trace.spans.map(s => s.startOffsetMs + s.durationMs));
                const leftPct   = (span.startOffsetMs / maxOffset) * 100;
                const widthPct  = Math.max(3, (span.durationMs / maxOffset) * 100);
                const barColor  = SVC_COLORS[span.service] ?? '#6A8FA8';
                const isError   = span.status === 'ERROR';

                return (
                  <div key={span.spanId} className="flex items-center gap-3">
                    <div
                      className="text-right text-[10px] font-mono flex-shrink-0 truncate"
                      style={{ width: 110, color: '#4A7494' }}
                    >
                      {span.operation}
                    </div>
                    <div className="flex-1 relative h-7">
                      <div
                        className="absolute h-full trace-bar flex items-center overflow-hidden"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          background: isError
                            ? 'linear-gradient(145deg, #FCA5A5 0%, #EF4444 100%)'
                            : `linear-gradient(145deg, ${barColor}EE 0%, ${barColor} 100%)`,
                          opacity: isError ? 0.85 : 1,
                        }}
                      >
                        <span className="px-3 text-[9px] text-white font-semibold truncate drop-shadow-sm">
                          {span.detail}
                        </span>
                      </div>
                    </div>
                    <div className="text-[9px] font-mono flex-shrink-0 w-14 text-right" style={{ color: '#6A8FA8' }}>
                      {span.durationMs}ms
                    </div>
                    {isError && (
                      <span
                        className="clay-pill text-[9px] px-2 py-0.5 font-bold flex-shrink-0"
                        style={{ color: '#EF4444' }}
                      >
                        ERR
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 clay-card">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl clay-card-sm"
              style={{ background: 'linear-gradient(148deg, #EEF7FD 0%, #D8ECF8 100%)' }}
            >
              🔍
            </div>
            <div className="text-center">
              <div className="text-[14px] font-semibold" style={{ color: '#1A3550' }}>
                Select an order to view its trace
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#6A8FA8' }}>
                Distributed trace waterfall shows every service call for an order lifecycle
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
