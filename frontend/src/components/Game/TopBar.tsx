import { Play, Pause, RotateCcw } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

const SPEEDS = [1, 2, 5, 10] as const;

function formatSimTime(simSeconds: number): string {
  const hours = Math.floor(simSeconds / 3600);
  const mins = Math.floor((simSeconds % 3600) / 60);
  const startHour = 8;
  const h = (startHour + hours) % 24;
  return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

const HEALTH_STYLES = {
  stable: { bg: 'rgba(78,159,91,0.15)', color: '#4E9F5B', icon: '🟢', label: 'Stable' },
  busy: { bg: 'rgba(230,180,46,0.15)', color: '#C89B2E', icon: '🟡', label: 'Busy' },
  critical: { bg: 'rgba(196,75,75,0.15)', color: '#C44B4B', icon: '🔴', label: 'Critical' },
} as const;

export default function TopBar() {
  const isRunning = useSimulationStore(s => s.isRunning);
  const speed = useSimulationStore(s => s.speed);
  const metrics = useSimulationStore(s => s.metrics);
  const simTime = useSimulationStore(s => s.simTime);
  const start = useSimulationStore(s => s.start);
  const pause = useSimulationStore(s => s.pause);
  const reset = useSimulationStore(s => s.reset);
  const setSpeed = useSimulationStore(s => s.setSpeed);

  const health = HEALTH_STYLES[metrics.networkHealth];

  return (
    <div className="clay-card flex items-center justify-between px-4" style={{ height: 60, borderRadius: 20 }}>
      {/* Left: Logo + Network Health */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-white font-black"
            style={{ width: 36, height: 36, borderRadius: 12, background: '#E66B2E', fontSize: 16, fontFamily: "'Nunito'" }}>
            V
          </div>
          <div>
            <h1 className="font-black text-sm leading-tight" style={{ fontFamily: "'Nunito'", color: '#1F2933' }}>VeloCity</h1>
            <p className="text-[9px] font-semibold" style={{ color: '#8A8A80' }}>Operations Center</p>
          </div>
        </div>

        <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: health.bg }}>
          <span className="text-xs">{health.icon}</span>
          <span className="text-xs font-bold" style={{ color: health.color }}>{health.label}</span>
        </div>
      </div>

      {/* Center: Key Metrics */}
      <div className="flex items-center gap-2">
        <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
          <span className="text-xs">📦</span>
          <span className="text-sm font-bold" style={{ color: '#E66B2E' }}>{metrics.pendingOrders}</span>
          <span className="text-[10px] font-medium" style={{ color: '#8A8A80' }}>Active</span>
        </div>
        <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
          <span className="text-xs">⚠️</span>
          <span className="text-sm font-bold" style={{ color: metrics.delayedOrders > 0 ? '#C44B4B' : '#8A8A80' }}>{metrics.delayedOrders}</span>
          <span className="text-[10px] font-medium" style={{ color: '#8A8A80' }}>Delayed</span>
        </div>
        <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
          <span className="text-xs">✅</span>
          <span className="text-sm font-bold" style={{ color: '#4E9F5B' }}>{metrics.completedDeliveries}</span>
          <span className="text-[10px] font-medium" style={{ color: '#8A8A80' }}>Done</span>
        </div>
        <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
          <span className="text-xs">😊</span>
          <span className="text-sm font-bold" style={{ color: metrics.customerSatisfaction >= 80 ? '#4E9F5B' : metrics.customerSatisfaction >= 60 ? '#C89B2E' : '#C44B4B' }}>
            {metrics.customerSatisfaction}%
          </span>
          <span className="text-[10px] font-medium" style={{ color: '#8A8A80' }}>Satisfaction</span>
        </div>
        <div className="clay-inset flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl">
          <span className="text-xs">🕐</span>
          <span className="text-sm font-bold" style={{ color: '#5A5A5A', fontFamily: "'Nunito'" }}>{formatSimTime(simTime)}</span>
        </div>
      </div>

      {/* Right: Speed + Play + Reset */}
      <div className="flex items-center gap-2">
        <div className="clay-inset flex items-center gap-0.5 p-1 rounded-xl">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
              style={{ background: speed === s ? '#1F2933' : 'transparent', color: speed === s ? '#fff' : '#8A8A80', minWidth: 28, border: 'none', cursor: 'pointer' }}>
              {s}x
            </button>
          ))}
        </div>
        <button onClick={() => (isRunning ? pause() : start())}
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, background: isRunning ? '#4E9F5B' : '#E66B2E', color: '#fff', cursor: 'pointer', border: 'none', borderRadius: 12 }}>
          {isRunning ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <button onClick={reset}
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, background: '#F3EFE7', cursor: 'pointer', border: 'none', borderRadius: 12 }}>
          <RotateCcw size={14} color="#5A5A5A" />
        </button>
      </div>
    </div>
  );
}
