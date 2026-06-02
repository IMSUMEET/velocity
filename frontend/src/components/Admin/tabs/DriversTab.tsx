import { usePlatformStore } from '../../../store/platformStore';
import { api } from '../../../services/api';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  IDLE:                   '#28B86A',
  EN_ROUTE_PICKUP:        '#0EA5E9',
  WAITING_AT_RESTAURANT:  '#C4923A',
  DELIVERING:             '#14B8A6',
  ON_BREAK:               '#8B5CF6',
  OFFLINE:                '#6A8FA8',
};

const ZONES = [
  'Downtown', 'Market District', 'University Row',
  'Harbor Point', 'Capitol Heights', 'Stadium District',
];

const STATUS_FILTERS = [
  'all', 'IDLE', 'EN_ROUTE_PICKUP', 'DELIVERING',
  'WAITING_AT_RESTAURANT', 'ON_BREAK', 'OFFLINE',
];

export default function DriversTab() {
  const drivers = usePlatformStore(s => s.drivers);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? drivers : drivers.filter(d => d.status === filter);

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Filter + Deploy ── */}
      <div
        className="clay-card-sm flex items-center gap-1.5 flex-wrap px-4 py-3"
        style={{ borderRadius: 16 }}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {STATUS_FILTERS.map(f => {
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
                  ? `All (${drivers.length})`
                  : f.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => api.drivers.deploy('BIKE')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold"
            style={{
              borderRadius: 10,
              background: 'rgba(20,184,166,0.12)',
              color: '#14B8A6',
              border: '1px solid rgba(20,184,166,0.25)',
            }}
          >
            🚴 Deploy Bike
          </button>
          <button
            onClick={() => api.drivers.deploy('CAR')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold"
            style={{
              borderRadius: 10,
              background: 'rgba(59,111,245,0.12)',
              color: '#0EA5E9',
              border: '1px solid rgba(59,111,245,0.25)',
            }}
          >
            🚗 Deploy Car
          </button>
        </div>
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
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Deliveries</th>
              <th>Fatigue</th>
              <th>Detail</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const col = STATUS_COLORS[d.status] ?? '#6A8FA8';
              return (
                <tr key={d.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                        style={{ background: col + '18' }}
                      >
                        {d.vehicleType === 'CAR' ? '🚗' : '🚴'}
                      </div>
                      <span className="font-semibold" style={{ color: '#1A3550' }}>{d.name}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold"
                      style={{ background: 'rgba(100,116,139,0.08)', color: '#4A7494' }}
                    >
                      {d.vehicleType}
                    </span>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: col + '20', color: col }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                      {d.status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold" style={{ color: '#1A3550' }}>
                      {d.rating.toFixed(1)} ⭐
                    </span>
                  </td>
                  <td>
                    <span className="font-bold text-[13px]" style={{ color: '#1A3550' }}>
                      {d.totalDeliveries}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-14 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'rgba(100,116,139,0.12)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, d.fatigue)}%`,
                            background: d.fatigue > 70
                              ? '#C46B58'
                              : d.fatigue > 40
                              ? '#C4923A'
                              : '#28B86A',
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: '#6A8FA8' }}
                      >
                        {Math.round(d.fatigue)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="text-[10px] truncate max-w-[140px] block" style={{ color: '#6A8FA8' }}>
                      {d.statusDetail || d.thoughtMessage || '—'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      {d.status === 'IDLE' && (
                        <select
                          onChange={e => { if (e.target.value) api.drivers.relocate(d.id, e.target.value); }}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                          style={{
                            background: 'rgba(59,111,245,0.08)',
                            color: '#0EA5E9',
                            border: '1px solid rgba(59,111,245,0.20)',
                            outline: 'none',
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Relocate…</option>
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                      )}
                      {d.status !== 'OFFLINE' && (
                        <button
                          onClick={() => api.drivers.forceOffline(d.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                          style={{
                            background: 'rgba(249,115,96,0.10)',
                            color: '#C46B58',
                            border: '1px solid rgba(249,115,96,0.22)',
                          }}
                        >
                          Offline
                        </button>
                      )}
                      {(d.status === 'OFFLINE' || d.status === 'ON_BREAK') && (
                        <button
                          onClick={() => api.drivers.bringOnline(d.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                          style={{
                            background: 'rgba(34,197,94,0.10)',
                            color: '#28B86A',
                            border: '1px solid rgba(34,197,94,0.22)',
                          }}
                        >
                          Online
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="text-center py-12 text-sm" style={{ color: '#6A8FA8' }}>
                    No drivers match this filter.
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
