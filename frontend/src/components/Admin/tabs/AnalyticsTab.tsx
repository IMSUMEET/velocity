import { usePlatformStore } from '../../../store/platformStore';
import { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface TimePoint {
  tick: number;
  delivered: number;
  pending: number;
  utilization: number;
  satisfaction: number;
  avgFatigue: number;
  p50: number;
  p95: number;
  fleetMiles: number;
  onBreak: number;
}

const STRATEGY_INSIGHTS: Record<string, { verdict: string; watch: string; color: string }> = {
  FASTEST_ETA: {
    color: '#0EA5E9',
    verdict: 'Great for speed, bad for driver health. Nearby drivers get overworked — leading to fatigue spikes and forced breaks.',
    watch: 'Watch the Fatigue & Breaks chart. If drivers keep going on break, pending orders spike while nobody is available.',
  },
  LOWEST_COST: {
    color: '#28B86A',
    verdict: 'Minimizes fleet miles, but distant customers wait longer. Good for company margin, bad for satisfaction.',
    watch: 'Watch the Satisfaction curve — it will drop when far-away orders sit waiting.',
  },
  BALANCED: {
    color: '#0EA5E9',
    verdict: 'The safe default. No single metric dominates — it trades off speed, cost, and driver fatigue equally.',
    watch: 'All charts should stay moderate. No fatigue spikes, no satisfaction crashes.',
  },
  BATCH_NEARBY: {
    color: '#C4923A',
    verdict: 'Groups nearby orders for one driver. Reduces redundant trips, but the first customer in a batch waits longer.',
    watch: 'Look for lower fleet miles. P50 latency may be higher since orders are held before dispatch.',
  },
  BATCH_OPTIMAL: {
    color: '#8B5CF6',
    verdict: 'Uses a TSP heuristic for the shortest multi-pickup route. Best fleet efficiency if there are enough orders.',
    watch: 'Compare fleet miles to other strategies. With low order volume, batching may not help.',
  },
};

const CHART_STYLE = {
  background: 'linear-gradient(145deg, #FFFFFF, #EEF4F7)',
  border: '1px solid rgba(100, 116, 139, 0.14)',
  borderRadius: 18,
  boxShadow: '8px 8px 20px rgba(15, 23, 42, 0.07), -8px -8px 20px rgba(255, 255, 255, 0.90)',
  padding: '16px',
};

const TOOLTIP_STYLE = {
  fontSize: 11,
  background: '#F8FAFC',
  border: '1px solid rgba(100, 116, 139, 0.14)',
  borderRadius: 12,
  boxShadow: '4px 4px 12px rgba(15, 23, 42, 0.06)',
};

function ChartCard({
  title, insight, icon, color, children,
}: {
  title: string; insight: string; icon: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={CHART_STYLE}>
      <div className="flex items-start gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: color + '14' }}
        >
          {icon}
        </div>
        <div>
          <div className="text-[12px] font-bold" style={{ color: '#1A3550' }}>{title}</div>
          <div
            className="text-[10px] leading-relaxed mt-0.5"
            style={{ color: '#4A7494' }}
          >
            {insight}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsTab() {
  const { metrics, simulation, drivers } = usePlatformStore();
  const [history, setHistory] = useState<TimePoint[]>([]);
  const lastTickRef = useRef(0);

  useEffect(() => {
    const tick = simulation.tickCount;
    if (tick <= lastTickRef.current) return;
    lastTickRef.current = tick;

    const busyDrivers = drivers.filter(d =>
      d.status === 'EN_ROUTE_PICKUP' || d.status === 'DELIVERING' || d.status === 'WAITING_AT_RESTAURANT'
    ).length;
    const totalActive  = drivers.filter(d => d.status !== 'OFFLINE').length;
    const utilization  = totalActive > 0 ? Math.round((busyDrivers / totalActive) * 100) : 0;
    const avgFatigue   = drivers.length > 0
      ? Math.round(drivers.reduce((sum, d) => sum + d.fatigue, 0) / drivers.length) : 0;
    const onBreak      = drivers.filter(d => d.status === 'ON_BREAK').length;

    setHistory(prev => {
      const next = [...prev, {
        tick,
        delivered:    metrics.completedDeliveries,
        pending:      metrics.pendingOrders,
        utilization,
        satisfaction: metrics.customerSatisfaction,
        avgFatigue,
        p50:          metrics.deliveryPercentiles.p50,
        p95:          metrics.deliveryPercentiles.p95,
        fleetMiles:   (metrics as any).totalFleetMiles ?? 0,
        onBreak,
      }];
      return next.length > 300 ? next.slice(-300) : next;
    });
  }, [simulation.tickCount, metrics, drivers]);

  const strategy = simulation.dispatchStrategy;
  const insight  = STRATEGY_INSIGHTS[strategy] ?? STRATEGY_INSIGHTS.BALANCED;

  const busyNow        = drivers.filter(d =>
    d.status === 'EN_ROUTE_PICKUP' || d.status === 'DELIVERING' || d.status === 'WAITING_AT_RESTAURANT'
  ).length;
  const totalActive    = drivers.filter(d => d.status !== 'OFFLINE').length;
  const utilizationNow = totalActive > 0 ? Math.round((busyNow / totalActive) * 100) : 0;
  const avgFatigueNow  = drivers.length > 0
    ? Math.round(drivers.reduce((sum, d) => sum + d.fatigue, 0) / drivers.length) : 0;
  const onBreakNow     = drivers.filter(d => d.status === 'ON_BREAK').length;

  const KPIS = [
    { label: 'Deliveries',   value: metrics.completedDeliveries,  color: '#28B86A',  icon: '✅' },
    { label: 'Pending',      value: metrics.pendingOrders,         color: metrics.pendingOrders > 5 ? '#C46B58' : '#1A3550', icon: '📦' },
    { label: 'Utilization',  value: `${utilizationNow}%`,         color: utilizationNow > 80 ? '#0EA5E9' : '#28B86A', icon: '⚙️' },
    { label: 'Avg Fatigue',  value: `${avgFatigueNow}/80`,        color: avgFatigueNow > 50 ? '#C46B58' : '#28B86A', icon: '💪' },
    { label: 'On Break',     value: onBreakNow,                   color: onBreakNow > 0 ? '#C4923A' : '#1A3550', icon: '☕' },
    { label: 'Satisfaction', value: `${metrics.customerSatisfaction}%`, color: metrics.customerSatisfaction < 70 ? '#C46B58' : '#28B86A', icon: '😊' },
  ];

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto pb-2">

      {/* ── Strategy Impact ── */}
      <div
        style={{
          ...CHART_STYLE,
          background: insight.color + '09',
          border: `1.5px solid ${insight.color}28`,
          boxShadow: `0 4px 14px ${insight.color}14`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: insight.color + '18' }}
          >
            🎯
          </div>
          <div>
            <div className="text-[12px] font-bold mb-1" style={{ color: '#1A3550' }}>
              Currently running:{' '}
              <span style={{ color: insight.color }}>{strategy}</span>
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: '#1A3550' }}>
              {insight.verdict}
            </div>
            <div className="text-[11px] leading-relaxed mt-1.5 italic" style={{ color: '#4A7494' }}>
              👉 {insight.watch}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-6 gap-3">
        {KPIS.map(({ label, value, color, icon }) => (
          <div
            key={label}
            style={{
              background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
              border: '1px solid rgba(255,255,255,0.88)',
              borderBottomColor: 'rgba(100,116,139,0.15)',
              borderRadius: 18,
              padding: '14px 16px',
              boxShadow: '6px 6px 16px rgba(45,38,30,0.07), -6px -6px 16px rgba(255,250,242,0.48)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: '#6A8FA8' }}>{label}</span>
            </div>
            <div className="text-[22px] font-extrabold leading-none" style={{ color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart 1: Fatigue & Breaks ── */}
      <ChartCard
        title="Driver Fatigue & Breaks"
        icon="💪"
        color="#0EA5E9"
        insight="When fatigue rises, drivers take mandatory breaks — removing them from the fleet. With Fastest ETA, the closest driver always wins, exhausting them while far drivers stay idle."
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={history} className="mt-2">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,228,234,0.6)" />
            <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="avgFatigue" stroke="#0EA5E9" fill="rgba(59,111,245,0.12)" strokeWidth={2} name="Avg Fatigue (0-80)" />
            <Area type="monotone" dataKey="onBreak"    stroke="#C46B58" fill="rgba(249,115,96,0.10)" strokeWidth={2} name="Drivers on Break" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Chart 2: Utilization & Satisfaction ── */}
      <ChartCard
        title="Utilization vs Satisfaction"
        icon="⚙️"
        color="#28B86A"
        insight="High utilization means drivers are busy (good for throughput). But if too many are busy with no idle backup, new orders wait — satisfaction drops. Sweet spot: ~60-80%."
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={history} className="mt-2">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,228,234,0.6)" />
            <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6A8FA8" domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="utilization"  stroke="#0EA5E9" fill="rgba(59,111,245,0.10)" strokeWidth={2} name="Utilization %" />
            <Area type="monotone" dataKey="satisfaction" stroke="#8B5CF6" fill="rgba(139,92,246,0.10)" strokeWidth={2} name="Satisfaction %" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Chart 3: Throughput ── */}
      <ChartCard
        title="Orders: Delivered vs Pending"
        icon="📦"
        color="#28B86A"
        insight="Green line should climb steadily. If red spikes above green's slope, the system can't keep up — either drivers are on break, or the strategy is assigning the wrong drivers."
      >
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={history} className="mt-2">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,228,234,0.6)" />
            <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="delivered" stroke="#28B86A" strokeWidth={2.5} dot={false} name="Total Delivered" />
            <Line type="monotone" dataKey="pending"   stroke="#C46B58" strokeWidth={2}   dot={false} name="Pending Now" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Chart 4: Latency ── */}
      <ChartCard
        title="Delivery Latency (P50 / P95)"
        icon="⏱️"
        color="#C4923A"
        insight="P50 = median delivery time. P95 = worst 5% of deliveries. A big gap means some customers are having a terrible experience while others are fine."
      >
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={history} className="mt-2">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,228,234,0.6)" />
            <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6A8FA8" unit="s" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="p50" stroke="#8B5CF6" strokeWidth={2.5} dot={false} name="P50 (median)" />
            <Line type="monotone" dataKey="p95" stroke="#C4923A" strokeWidth={2}   dot={false} name="P95 (worst 5%)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Chart 5: Fleet miles ── */}
      <ChartCard
        title="Fleet Miles (cumulative)"
        icon="🗺️"
        color="#14B8A6"
        insight="Total distance driven. Steeper = burning more fuel per delivery. Lowest Cost and Batch strategies should show a shallower slope."
      >
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={history} className="mt-2">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(223,228,234,0.6)" />
            <XAxis dataKey="tick" tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6A8FA8" />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="fleetMiles" stroke="#14B8A6" fill="rgba(20,184,166,0.12)" strokeWidth={2.5} name="Fleet Miles" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Comparison guide ── */}
      <div style={CHART_STYLE}>
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(59,111,245,0.10)' }}
          >
            📋
          </div>
          <div className="text-[12px] font-bold" style={{ color: '#1A3550' }}>How to Compare Strategies</div>
        </div>
        <div className="flex flex-col gap-2.5 text-[11px]" style={{ color: '#4A7494' }}>
          {[
            { num: '1', text: <>Run <b style={{ color: '#0EA5E9' }}>Fastest ETA</b> for ~100 ticks. Note the fatigue spikes and break frequency.</> },
            { num: '2', text: <>Reset and switch to <b style={{ color: '#28B86A' }}>Balanced</b>. Compare fatigue and pending orders.</> },
            { num: '3', text: <>Reset and try <b style={{ color: '#28B86A' }}>Lowest Cost</b>. Watch satisfaction drop for distant orders.</> },
            { num: '4', text: <>For rigorous comparison, use <b>About & Research → Run Comparison</b> experiment tool.</> },
          ].map(({ num, text }) => (
            <div key={num} className="flex gap-3 items-start">
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(59,111,245,0.10)', color: '#0EA5E9' }}
              >
                {num}
              </div>
              <div className="leading-relaxed">{text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
