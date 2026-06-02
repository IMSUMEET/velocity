import { usePlatformStore } from '../../../store/platformStore';
import { api } from '../../../services/api';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  CREATED:           '#a78bfa',
  FINDING_DRIVER:    '#fbbf24',
  EN_ROUTE_PICKUP:   '#60a5fa',
  WAITING_FOR_FOOD:  '#fb923c',
  PICKED_UP:         '#34d399',
  EN_ROUTE_DELIVERY: '#22d3ee',
  DELIVERED:         '#4ade80',
  DELAYED:           '#f87171',
};

const MOOD_EMOJI: Record<string, string> = {
  HAPPY: '😊', WAITING: '🕐', FRUSTRATED: '😤', ANGRY: '😡',
};

const FILTERS = [
  'all', 'CREATED', 'FINDING_DRIVER', 'EN_ROUTE_PICKUP',
  'WAITING_FOR_FOOD', 'EN_ROUTE_DELIVERY', 'DELIVERED', 'DELAYED',
];

export default function OrdersTab() {
  const orders = usePlatformStore(s => s.orders);
  const [filter, setFilter] = useState<string>('all');

  const sorted = [...orders]
    .filter(o => filter === 'all' || o.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Filter pills ── */}
      <div
        className="clay-card-sm flex items-center gap-1.5 flex-wrap px-4 py-3"
        style={{ borderRadius: 16 }}
      >
        {FILTERS.map(f => {
          const active = filter === f;
          const col = f !== 'all' ? STATUS_COLORS[f] ?? '#6A8FA8' : '#0EA5E9';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-[11px] font-semibold transition-all"
              style={{
                borderRadius: 10,
                background: active ? `${col}18` : 'transparent',
                border: active ? `1px solid ${col}38` : '1px solid transparent',
                color: active ? col : '#4A7494',
                boxShadow: active ? `0 3px 10px ${col}18` : 'none',
              }}
            >
              {f === 'all'
                ? `All (${orders.length})`
                : f.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
            </button>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div
        className="flex-1 overflow-auto"
        style={{
          background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
          border: '1px solid rgba(255,255,255,0.88)',
          borderBottomColor: 'rgba(100,116,139,0.15)',
          borderRightColor: 'rgba(100,116,139,0.12)',
          borderRadius: 20,
          boxShadow: '8px 8px 22px rgba(45,38,30,0.08), -8px -8px 22px rgba(255,250,242,0.48)',
        }}
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Restaurant</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Value</th>
              <th>Age</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map(o => {
              const ageS   = Math.round((Date.now() - o.createdAt) / 1000);
              const col    = STATUS_COLORS[o.status] ?? '#6A8FA8';
              return (
                <tr key={o.id}>
                  <td>
                    <span
                      className="font-mono text-[11px] font-semibold"
                      style={{ color: '#4A7494' }}
                    >
                      #{o.id}
                    </span>
                  </td>
                  <td>
                    <span className="font-medium" style={{ color: '#1A3550' }}>{o.restaurantName}</span>
                  </td>
                  <td>
                    <span className="font-medium" style={{ color: '#1A3550' }}>
                      {MOOD_EMOJI[o.mood] ?? ''} {o.customerName}
                    </span>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: col + '20', color: col }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: col }}
                      />
                      {o.status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                    </span>
                  </td>
                  <td>
                    <span
                      className="font-semibold text-[11px]"
                      style={{ color: o.priority > 5 ? '#C46B58' : '#4A7494' }}
                    >
                      {o.priority}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold text-[11px]" style={{ color: '#1A3550' }}>
                      ${o.estimatedValue.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[11px]" style={{ color: '#6A8FA8' }}>
                      {ageS}s
                    </span>
                  </td>
                  <td>
                    {o.status !== 'DELIVERED' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => api.orders.reassign(o.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                          style={{
                            background: 'rgba(59,111,245,0.08)',
                            color: '#0EA5E9',
                            border: '1px solid rgba(59,111,245,0.18)',
                          }}
                        >
                          Reassign
                        </button>
                        <button
                          onClick={() => api.orders.boostPriority(o.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                          style={{
                            background: 'rgba(245,158,11,0.08)',
                            color: '#C4923A',
                            border: '1px solid rgba(245,158,11,0.18)',
                          }}
                        >
                          Boost
                        </button>
                        <button
                          onClick={() => api.orders.cancel(o.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                          style={{
                            background: 'rgba(249,115,96,0.10)',
                            color: '#C46B58',
                            border: '1px solid rgba(249,115,96,0.22)',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="text-center py-12 text-sm" style={{ color: '#6A8FA8' }}>
                    No orders match this filter.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
