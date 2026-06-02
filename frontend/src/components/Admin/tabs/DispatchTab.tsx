import { usePlatformStore, type DispatchAttempt } from '../../../store/platformStore';
import { api } from '../../../services/api';
import { useState } from 'react';

const STRATEGIES = [
  { id: 'BALANCED',     label: 'Balanced',      icon: '⚖️', color: '#0EA5E9', desc: 'Multi-factor score: distance + ETA + age' },
  { id: 'FASTEST_ETA',  label: 'Fastest ETA',   icon: '⚡', color: '#0EA5E9', desc: 'Minimize time to customer door' },
  { id: 'LOWEST_COST',  label: 'Lowest Cost',   icon: '💰', color: '#28B86A', desc: 'Minimize total fleet distance' },
  { id: 'BATCH_NEARBY', label: 'Batch Nearby',  icon: '📦', color: '#C4923A', desc: 'Hold & group proximal orders' },
  { id: 'BATCH_OPTIMAL',label: 'Batch Optimal', icon: '🧠', color: '#8B5CF6', desc: 'Hold & group via greedy TSP insertion' },
];

export default function DispatchTab() {
  const { recentDispatch, simulation } = usePlatformStore();
  const [selectedAttempt, setSelectedAttempt] = useState<DispatchAttempt | null>(null);
  const isBatch = simulation.dispatchStrategy.startsWith('BATCH');

  return (
    <div className="flex gap-3 h-full">

      {/* ── Left: strategy + attempts ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Strategy selector */}
        <div
          style={{
            background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
            border: '1px solid rgba(255,255,255,0.88)',
            borderBottomColor: 'rgba(100,116,139,0.15)',
            borderRadius: 20,
            boxShadow: '6px 6px 16px rgba(45,38,30,0.07), -6px -6px 16px rgba(255,250,242,0.48)',
            padding: '16px',
          }}
        >
          <div
            className="text-[10px] font-extrabold uppercase tracking-widest mb-3"
            style={{ color: '#6A8FA8', letterSpacing: '0.12em' }}
          >
            Dispatch Strategy
          </div>
          <div className="flex flex-wrap gap-2">
            {STRATEGIES.map(s => {
              const active = simulation.dispatchStrategy === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => api.dispatch.setStrategy(s.id)}
                  title={s.desc}
                  className="flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold transition-all"
                  style={{
                    borderRadius: 13,
                    background: active ? `${s.color}18` : 'rgba(238,243,247,0.7)',
                    border: active ? `1.5px solid ${s.color}40` : '1px solid rgba(223,228,234,0.7)',
                    color: active ? s.color : '#4A7494',
                    boxShadow: active ? `0 4px 14px ${s.color}20` : 'none',
                  }}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
          {isBatch && (
            <div
              className="mt-3 text-[10px] px-3 py-2 rounded-xl font-medium"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#28B86A', border: '1px solid rgba(34,197,94,0.18)' }}
            >
              📦 Batch mode: orders are held ~5 ticks, clustered by restaurant proximity, then dispatched as multi-stop routes.
              See batch savings % below.
            </div>
          )}
        </div>

        {/* Attempts table */}
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
                <th>Matched</th>
                <th>Driver</th>
                <th>Score</th>
                <th>Candidates</th>
                {isBatch && <th>Batch</th>}
                {isBatch && <th>Savings</th>}
              </tr>
            </thead>
            <tbody>
              {recentDispatch.slice(0, 50).map(a => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedAttempt(a)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span className="font-mono text-[11px] font-semibold" style={{ color: '#4A7494' }}>
                      #{a.orderId}
                    </span>
                  </td>
                  <td>
                    <span className="font-medium max-w-[130px] block truncate" style={{ color: '#1A3550' }}>
                      {a.restaurantName}
                    </span>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: a.matched ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,96,0.15)',
                        color: a.matched ? '#28B86A' : '#C46B58',
                      }}
                    >
                      {a.matched ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td>
                    <span className="font-medium" style={{ color: '#1A3550' }}>
                      {a.selectedDriverName || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono font-semibold" style={{ color: '#0EA5E9' }}>
                      {a.score.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(100,116,139,0.08)', color: '#4A7494' }}
                    >
                      {a.candidatesEvaluated}
                    </span>
                  </td>
                  {isBatch && (
                    <td>
                      {a.batchId ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#28B86A' }}
                        >
                          {a.batchSize}×
                        </span>
                      ) : '—'}
                    </td>
                  )}
                  {isBatch && (
                    <td>
                      {(a.batchSavingsPercent ?? 0) > 0 ? (
                        <span className="font-semibold" style={{ color: '#28B86A' }}>
                          {(a.batchSavingsPercent ?? 0).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              ))}
              {recentDispatch.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="text-center py-12 text-sm" style={{ color: '#6A8FA8' }}>
                      No dispatch attempts yet. Start the simulation to see dispatch decisions.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right: candidate detail ── */}
      {selectedAttempt && (
        <div
          className="float-in-up"
          style={{
            width: 340,
            background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
            border: '1px solid rgba(255,255,255,0.88)',
            borderBottomColor: 'rgba(100,116,139,0.15)',
            borderRightColor: 'rgba(100,116,139,0.12)',
            borderRadius: 20,
            boxShadow: '8px 8px 22px rgba(45,38,30,0.09), -8px -8px 22px rgba(255,250,242,0.48)',
            padding: 16,
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[14px] font-bold" style={{ color: '#1A3550' }}>
                Dispatch Attempt
              </div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: '#6A8FA8' }}>
                {selectedAttempt.id}
              </div>
            </div>
            <button
              onClick={() => setSelectedAttempt(null)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
              style={{ background: 'rgba(100,116,139,0.08)', color: '#4A7494' }}
            >
              Close
            </button>
          </div>

          <div
            className="rounded-xl px-3 py-2.5 mb-3 text-[11px]"
            style={{ background: 'rgba(59,111,245,0.07)', border: '1px solid rgba(59,111,245,0.15)' }}
          >
            <div className="flex gap-3 flex-wrap">
              <span style={{ color: '#4A7494' }}>
                Strategy: <b style={{ color: '#0EA5E9' }}>{selectedAttempt.strategy}</b>
              </span>
              <span style={{ color: '#4A7494' }}>
                Order: <b style={{ color: '#1A3550' }}>#{selectedAttempt.orderId}</b>
              </span>
            </div>
          </div>

          {selectedAttempt.batchId && (
            <div
              className="mb-3 px-3 py-2 rounded-xl text-[11px] font-medium"
              style={{ background: 'rgba(34,197,94,0.08)', color: '#28B86A', border: '1px solid rgba(34,197,94,0.18)' }}
            >
              📦 Batch ID: <b>{selectedAttempt.batchId}</b> · Size: <b>{selectedAttempt.batchSize}</b> ·
              Savings: <b>{selectedAttempt.batchSavingsPercent?.toFixed(1)}%</b> vs greedy
            </div>
          )}

          <div className="flex flex-col gap-2">
            {selectedAttempt.candidates.map((c, i) => (
              <div
                key={c.driverId}
                className="rounded-xl px-3 py-2.5 text-[11px]"
                style={{
                  background: c.selected
                    ? 'linear-gradient(150deg,rgba(34,197,94,0.10),rgba(34,197,94,0.06))'
                    : 'rgba(238,243,247,0.7)',
                  border: c.selected
                    ? '1.5px solid rgba(34,197,94,0.30)'
                    : '1px solid rgba(223,228,234,0.6)',
                  boxShadow: c.selected ? '0 4px 12px rgba(34,197,94,0.12)' : 'none',
                }}
              >
                <div className="flex justify-between items-center font-semibold mb-1.5">
                  <span style={{ color: '#1A3550' }}>
                    {c.selected ? '✓ ' : `${i + 1}. `}
                    {c.vehicleType === 'CAR' ? '🚗' : '🚴'} {c.driverName}
                  </span>
                  <span
                    className="font-mono font-bold"
                    style={{ color: c.selected ? '#28B86A' : '#6A8FA8' }}
                  >
                    {c.score.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-3 text-[10px]" style={{ color: '#6A8FA8' }}>
                  <span>{c.vehicleType}</span>
                  <span>dist: {c.distance.toFixed(1)}</span>
                  <span>eta: {c.eta.toFixed(1)}</span>
                </div>
                {c.scoreBreakdown && (
                  <div className="mt-1.5 flex gap-2 flex-wrap text-[9px]" style={{ color: '#B8C4CF' }}>
                    <span>dist:{c.scoreBreakdown.distanceScore}</span>
                    <span>eta:{c.scoreBreakdown.etaScore}</span>
                    <span>age:{c.scoreBreakdown.orderAgeScore}</span>
                    <span>exp:{c.scoreBreakdown.experienceBonus}</span>
                    <span>veh:{c.scoreBreakdown.vehicleBonus}</span>
                  </div>
                )}
                {c.rejectReason && (
                  <div className="mt-1 text-[10px]" style={{ color: '#C46B58' }}>
                    {c.rejectReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
