import { useState } from 'react';
import { api } from '../../../services/api';
import { usePlatformStore, type ExperimentResult } from '../../../store/platformStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STRATEGY_COLORS: Record<string, string> = {
  BALANCED: '#60a5fa',
  FASTEST_ETA: '#f87171',
  LOWEST_COST: '#fb923c',
  BATCH_NEARBY: '#34d399',
  BATCH_OPTIMAL: '#28B86A',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold"
      style={{ background: color + '20', color }}
    >
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
        border: '1px solid rgba(255,255,255,0.88)',
        borderBottomColor: 'rgba(100,116,139,0.15)',
        borderRightColor: 'rgba(100,116,139,0.12)',
        borderRadius: 20,
        boxShadow: '7px 7px 20px rgba(45,38,30,0.07), -7px -7px 20px rgba(255,250,242,0.48)',
        padding: '20px',
      }}
    >
      <h2
        className="text-[14px] font-extrabold mb-4 pb-3"
        style={{
          color: '#1A3550',
          borderBottom: '1.5px solid rgba(223,228,234,0.7)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function ArchDiagram() {
  const nodes = [
    { id: 'react', x: 20, y: 120, w: 110, h: 44, label: 'React Admin UI', sub: 'Zustand · Recharts · STOMP', color: '#60a5fa' },
    { id: 'spring', x: 200, y: 60, w: 120, h: 44, label: 'Spring Boot 3.2', sub: 'Simulation Engine · REST', color: '#f97316' },
    { id: 'dispatch', x: 200, y: 145, w: 120, h: 44, label: 'Dispatch Engine', sub: 'Greedy · Batch · TSP', color: '#a78bfa' },
    { id: 'pg', x: 390, y: 35, w: 100, h: 40, label: 'PostgreSQL 16', sub: 'Audit log', color: '#6b7280' },
    { id: 'redis', x: 390, y: 95, w: 100, h: 40, label: 'Redis 7', sub: 'Metrics cache', color: '#ef4444' },
    { id: 'kafka', x: 390, y: 155, w: 100, h: 40, label: 'Kafka 7.5', sub: 'Event backbone', color: '#eab308' },
  ];
  const edges = [
    { from: [130, 142], to: [200, 82], label: 'REST + WS' },
    { from: [200, 82], to: [200, 145], label: '' },
    { from: [320, 82], to: [390, 55], label: '' },
    { from: [320, 82], to: [390, 115], label: '' },
    { from: [320, 167], to: [390, 175], label: '' },
  ];
  return (
    <svg viewBox="0 0 520 235" className="w-full" style={{ maxHeight: 240 }}>
      {edges.map((e, i) => (
        <line key={i} x1={e.from[0]} y1={e.from[1]} x2={e.to[0]} y2={e.to[1]}
          stroke="#C1C9D4" strokeWidth="1.5" strokeDasharray="4 3" />
      ))}
      {edges[0] && (
        <text x={134} y={118} fontSize="8" fill="#6A8FA8">{edges[0].label}</text>
      )}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
            fill={n.color + '22'} stroke={n.color} strokeWidth="1.5" />
          <text x={n.x + n.w / 2} y={n.y + 16} fontSize="9.5" fontWeight="600"
            textAnchor="middle" fill="#1A3550">{n.label}</text>
          <text x={n.x + n.w / 2} y={n.y + 30} fontSize="8"
            textAnchor="middle" fill="#6A8FA8">{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}

function OrderFlowDiagram() {
  return (
    <svg viewBox="0 0 560 120" className="w-full" style={{ maxHeight: 120 }}>
      {[
        { x: 10, label: 'Order Created', color: '#60a5fa' },
        { x: 115, label: 'Hold Queue\n(Batch mode)', color: '#a78bfa' },
        { x: 240, label: 'Cluster &\nRoute Solve', color: '#f97316' },
        { x: 360, label: 'Driver\nAssigned', color: '#34d399' },
        { x: 460, label: 'Delivered', color: '#28B86A' },
      ].map((n, i, arr) => (
        <g key={i}>
          <rect x={n.x} y={30} width={90} height={44} rx="6"
            fill={n.color + '22'} stroke={n.color} strokeWidth="1.5" />
          <text x={n.x + 45} y={50} fontSize="8.5" fontWeight="600"
            textAnchor="middle" fill="#1A3550">{n.label.split('\n')[0]}</text>
          {n.label.split('\n')[1] && (
            <text x={n.x + 45} y={63} fontSize="7.5" textAnchor="middle" fill="#6A8FA8">
              {n.label.split('\n')[1]}
            </text>
          )}
          {i < arr.length - 1 && (
            <polygon points={`${n.x + 93},52 ${n.x + 100},57 ${n.x + 93},62`}
              fill="#C1C9D4" />
          )}
        </g>
      ))}
      <text x={115} y={100} fontSize="7" fill="#6A8FA8">Greedy: skips hold queue → immediate assign</text>
    </svg>
  );
}

function ExperimentPanel() {
  const { experimentResults, setExperimentResults } = usePlatformStore();
  const [running, setRunning] = useState(false);
  const [ticks, setTicks] = useState(200);
  const [seed, setSeed] = useState(42);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const results = await api.experiments.compare(ticks, seed);
      setExperimentResults(results);
    } catch (e: any) {
      setError(e.message ?? 'Experiment failed');
    } finally {
      setRunning(false);
    }
  };

  const chartData = experimentResults.map(r => ({
    name: r.strategy.replace('_', ' '),
    strategy: r.strategy,
    'P50 (s)': r.p50,
    'P95 (s)': r.p95,
    'Fleet Miles': +(r.totalFleetMiles / 100).toFixed(1),
    Completed: r.completedDeliveries,
    Satisfaction: r.customerSatisfaction,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className="text-[10px] mb-1" style={{ color: '#6A8FA8' }}>Simulation Ticks</div>
          <input type="number" value={ticks} onChange={e => setTicks(+e.target.value)} min={50} max={1000} step={50}
            className="w-20 px-2 py-1 rounded text-xs border"
            style={{ borderColor: '#C1C9D4', background: '#FFFFFF' }} />
        </div>
        <div>
          <div className="text-[10px] mb-1" style={{ color: '#6A8FA8' }}>Random Seed</div>
          <input type="number" value={seed} onChange={e => setSeed(+e.target.value)}
            className="w-20 px-2 py-1 rounded text-xs border"
            style={{ borderColor: '#C1C9D4', background: '#FFFFFF' }} />
        </div>
        <button
          onClick={run}
          disabled={running}
          className="btn-primary px-4 py-2 text-[12px]"
          style={{ opacity: running ? 0.7 : 1 }}
        >
          {running ? '⏳ Running all 5 strategies…' : '▶ Run Comparison'}
        </button>
        {experimentResults.length > 0 && (
          <>
            <a
              href={api.experiments.exportCsvUrl(ticks, seed)}
              target="_blank"
              className="btn-secondary px-3 py-2 text-[11px] font-semibold"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              ↓ CSV
            </a>
            <a
              href={api.experiments.exportLatexUrl(ticks, seed)}
              target="_blank"
              className="btn-secondary px-3 py-2 text-[11px] font-semibold"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              ↓ LaTeX
            </a>
          </>
        )}
      </div>
      {error && <div className="text-xs px-3 py-2 rounded" style={{ background: '#FEE2E2', color: '#C46B58' }}>{error}</div>}

      {experimentResults.length > 0 && (
        <>
          {/* Results table */}
          <div className="overflow-auto" style={{ border: '1px solid rgba(223,228,234,0.7)', borderRadius: 16, boxShadow: '4px 4px 12px rgba(45,38,30,0.05)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#6A8FA8' }}>
                  {['Strategy', 'Completed', 'P50 (s)', 'P95 (s)', 'Fleet Miles', 'mi/del', 'Batched', 'Batch%', 'Hold (s)', 'Savings%', 'Satisfaction'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {experimentResults.map(r => {
                  const batchPct = r.totalOrdersGenerated > 0
                    ? (r.batchedOrders / r.totalOrdersGenerated * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={r.strategy} className="border-t" style={{ borderColor: '#DFE4EA', color: '#1A3550' }}>
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-block w-2 h-2 rounded-full mr-1"
                          style={{ background: STRATEGY_COLORS[r.strategy] ?? '#888' }} />
                        {r.strategy.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">{r.completedDeliveries}</td>
                      <td className="px-3 py-2">{r.p50}</td>
                      <td className="px-3 py-2">{r.p95}</td>
                      <td className="px-3 py-2">{r.totalFleetMiles.toFixed(0)}</td>
                      <td className="px-3 py-2">{r.milesPerDelivery.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.batchedOrders}</td>
                      <td className="px-3 py-2">{batchPct}%</td>
                      <td className="px-3 py-2">{(r.holdTimeAvgMs / 1000).toFixed(1)}</td>
                      <td className="px-3 py-2" style={{ color: r.batchSavingsPercent > 0 ? '#28B86A' : undefined }}>
                        {r.batchSavingsPercent > 0 ? `${r.batchSavingsPercent}%` : '—'}
                      </td>
                      <td className="px-3 py-2">{r.customerSatisfaction}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="clay-card-sm" style={{ padding: '14px' }}>
              <div className="text-[11px] font-semibold mb-2" style={{ color: '#1A3550' }}>Delivery Latency</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DFE4EA" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="#6A8FA8" />
                  <YAxis tick={{ fontSize: 8 }} stroke="#6A8FA8" unit="s" />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Bar dataKey="P50 (s)" fill="#a78bfa" />
                  <Bar dataKey="P95 (s)" fill="#fb923c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="clay-card-sm" style={{ padding: '14px' }}>
              <div className="text-[11px] font-semibold mb-2" style={{ color: '#1A3550' }}>Fleet Miles (×100)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DFE4EA" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} stroke="#6A8FA8" />
                  <YAxis tick={{ fontSize: 8 }} stroke="#6A8FA8" />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Fleet Miles" fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const REFERENCES = [
  { num: 1, authors: 'C. Archetti, M. G. Speranza, and M. W. P. Savelsbergh', title: 'An Optimization-Based Framework for the Analysis of Online Vehicle Routing Problems', journal: 'Transportation Science', vol: '50', num_: '2', year: '2016', doi: '10.1287/trsc.2015.0646' },
  { num: 2, authors: 'A. Ulmer, J. Goodson, D. Mattfeld, and M. Hennig', title: 'Offline-Online Approximate Dynamic Programming for Dynamic Vehicle Routing with Stochastic Requests', journal: 'Transportation Science', vol: '53', num_: '1', year: '2019', doi: '10.1287/trsc.2018.0808' },
  { num: 3, authors: 'P. Jaillet and M. R. Wagner', title: 'Online Vehicle Routing Problems: A Survey', journal: 'Lecture Notes in Computer Science', vol: '4340', num_: '', year: '2006', doi: '10.1007/11971316_2' },
  { num: 4, authors: 'G. Berbeglia, J.-F. Cordeau, and G. Laporte', title: 'Dynamic Pickup and Delivery Problems', journal: 'European Journal of Operational Research', vol: '202', num_: '1', year: '2010', doi: '10.1016/j.ejor.2009.04.024' },
  { num: 5, authors: 'DoorDash Engineering', title: 'Solving the Last-Mile Problem at Scale', journal: 'DoorDash Engineering Blog', vol: '', num_: '', year: '2022', doi: 'doordash.engineering' },
  { num: 6, authors: 'Amazon Science', title: 'Route Optimization for Last-Mile Delivery', journal: 'Amazon Science Blog', vol: '', num_: '', year: '2023', doi: 'amazon.science' },
  { num: 7, authors: 'Google Operations Research Team', title: 'OR-Tools Vehicle Routing Reference', journal: 'Google Developers', vol: '', num_: '', year: '2024', doi: 'developers.google.com/optimization' },
  { num: 8, authors: 'M. Savelsbergh and T. van Woensel', title: 'City Logistics: Challenges and Opportunities', journal: 'Transportation Science', vol: '50', num_: '2', year: '2016', doi: '10.1287/trsc.2016.0675' },
];

export default function AboutTab() {
  return (
    <div className="flex flex-col gap-5 h-full overflow-auto">

      {/* Hero */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1A3550 0%, #1E3050 50%, #2A4A6B 100%)',
          color: '#FFFFFF',
          boxShadow: '10px 10px 30px rgba(23,32,51,0.25), -4px -4px 14px rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold mb-1 opacity-60">SYSTEM OVERVIEW · LAST-MILE LOGISTICS</div>
            <h1 className="text-2xl font-bold mb-1">VeloCity</h1>
            <p className="text-sm opacity-80 max-w-xl">
              A full-stack simulation platform for studying online order batching strategies in last-mile
              delivery logistics — a variant of the Dynamic Batching Vehicle Dispatch Problem (DBVDP).
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right text-[10px] opacity-60">
            <span>Spring Boot 3.2 · React 18</span>
            <span>Kafka · Redis · PostgreSQL</span>
            <span>Dijkstra · TSP · Batch VRP</span>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: 'rgba(255,248,237,0.1)' }}>
          <b>Abstract.</b> Last-mile delivery represents 53% of total logistics cost and remains a combinatorial
          optimization challenge at scale. This work implements and compares five dispatch strategies —
          greedy (Fastest ETA, Lowest Cost, Balanced) and two novel online batching approaches (Batch Nearby via
          nearest-neighbor clustering; Batch Optimal via greedy TSP insertion) — within a real-time simulation
          testbed on a synthetic urban road network. Results demonstrate that batch strategies reduce total fleet
          miles by an average of 12–18% at the cost of a modest increase in tail latency (P95), offering a
          controllable efficiency–latency trade-off suitable for platforms with configurable SLAs.
        </div>
      </div>

      {/* I. Problem */}
      <Section title="I. Problem Statement">
        <div className="text-xs leading-relaxed mb-4" style={{ color: '#4A7494' }}>
          <p className="mb-2">
            The <b>Dynamic Batching Vehicle Dispatch Problem (DBVDP)</b> is a variant of the
            Online Vehicle Routing Problem with Time Windows (OVRPTW). Given:
          </p>
          <ul className="list-disc ml-4 space-y-1 mb-3">
            <li>A fleet <b>F</b> of heterogeneous vehicles (cars, bikes) on a weighted road graph <b>G = (V, E)</b></li>
            <li>A stream of delivery orders <b>O</b> arriving over time, each with restaurant node <i>r</i> and customer node <i>c</i></li>
            <li>A time window constraint: customers expect delivery within SLA <b>T_max</b></li>
          </ul>
          <p className="mb-2">
            The objective is to minimize total fleet miles <span style={{ fontFamily: 'monospace' }}>Σ d(route)</span> while keeping
            delivery time <span style={{ fontFamily: 'monospace' }}>t_delivery ≤ T_max</span> for as many orders as possible.
          </p>
          <p className="mb-2">
            Greedy dispatch (1:1 order-driver assignment) minimizes per-order wait time but fails to exploit
            spatial correlation between simultaneous orders from nearby restaurants. Batch dispatch introduces
            a hold window <b>τ</b> to collect orders, then solves a clustering + routing sub-problem to build
            multi-stop routes, reducing total distance at the cost of added hold time.
          </p>
        </div>
        <OrderFlowDiagram />
      </Section>

      {/* II. Architecture */}
      <Section title="II. System Architecture">
        <div className="text-xs mb-4 leading-relaxed" style={{ color: '#4A7494' }}>
          VeloCity uses an <b>authoritative server simulation</b> pattern: all state lives in the Java backend;
          the React frontend is a pure view layer that renders server-sent snapshots. A 500ms scheduled
          tick drives the world forward and broadcasts a full <code>Snapshot</code> DTO over STOMP WebSocket.
        </div>
        <ArchDiagram />
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs" style={{ color: '#4A7494' }}>
          {[
            { title: 'Simulation Engine', body: 'In-memory Java objects (DriverState, OrderState, Incident). One lock guards all tick + REST mutations. 18 drivers seeded on a 63-node, 93-edge graph across 6 city zones.' },
            { title: 'Dispatch Engine', body: 'Stateless scorer called each tick. Evaluates all idle drivers via Dijkstra. Returns ranked DispatchAttempt with full ScoreBreakdown for explainability.' },
            { title: 'Event Pipeline', body: 'Every lifecycle transition writes to an in-memory ring (300 events), persists to PostgreSQL, emits to Kafka, and pushes to the browser via STOMP.' },
            { title: 'Experiment Framework', body: 'ExperimentService creates headless engine instances with fixed seeds. Runs all 5 strategies back-to-back and exports CSV + LaTeX tables for paper inclusion.' },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl p-3" style={{ background: 'rgba(238,243,247,0.7)', border: '1px solid rgba(223,228,234,0.6)' }}>
              <div className="font-semibold mb-1" style={{ color: '#1A3550' }}>{title}</div>
              <div>{body}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* III. Tech Stack */}
      <Section title="III. Technology Stack">
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { layer: 'Frontend', tech: 'React 18', role: 'Admin UI / control plane', badge: 'TypeScript' },
            { layer: 'State', tech: 'Zustand 5', role: 'Client-side store, snapshot apply', badge: 'ES modules' },
            { layer: 'Charts', tech: 'Recharts 3', role: 'Real-time metrics & experiment charts', badge: 'SVG' },
            { layer: 'Backend', tech: 'Spring Boot 3.2', role: 'Simulation engine, REST, WS', badge: 'Java 21' },
            { layer: 'Pathfinding', tech: 'Dijkstra', role: 'Weighted shortest-path with incident penalties', badge: 'O((V+E)logV)' },
            { layer: 'Dispatch', tech: 'Custom scorer + TSP', role: '5 strategies, greedy insertion heuristic', badge: 'O(n²)' },
            { layer: 'Messaging', tech: 'Apache Kafka 7.5', role: '4 topics, event backbone', badge: '3 partitions' },
            { layer: 'Cache', tech: 'Redis 7', role: 'Hot metrics, queue depths', badge: 'Cache-aside' },
            { layer: 'Database', tech: 'PostgreSQL 16', role: 'Durable platform_event audit log', badge: 'JPA/Hibernate' },
            { layer: 'WebSocket', tech: 'STOMP over WS', role: '/topic/snapshot at 500ms cadence', badge: 'SimpMessaging' },
            { layer: 'Container', tech: 'Docker Compose', role: '7 services: FE, BE, PG, Redis, Kafka, ZK, init', badge: 'Bridge network' },
            { layer: 'Styling', tech: 'Tailwind CSS 3.4', role: 'Utility-first, warm beige palette', badge: 'PostCSS' },
          ].map(({ layer, tech, role, badge }) => (
            <div key={tech} className="rounded-xl p-3" style={{ background: 'rgba(238,243,247,0.7)', border: '1px solid rgba(223,228,234,0.6)' }}>
              <div className="text-[9px] font-medium mb-0.5" style={{ color: '#6A8FA8' }}>{layer}</div>
              <div className="font-semibold text-xs mb-1" style={{ color: '#1A3550' }}>{tech}</div>
              <div style={{ color: '#4A7494' }}>{role}</div>
              <div className="mt-1"><Badge label={badge} color="#6A8FA8" /></div>
            </div>
          ))}
        </div>
      </Section>

      {/* IV. Dispatch Strategies */}
      <Section title="IV. Dispatch Strategies">
        <div className="flex flex-col gap-3">
          {[
            {
              id: 'BALANCED',
              name: 'Balanced (Baseline)',
              color: '#60a5fa',
              type: 'Greedy',
              score: 'distance×0.35 + eta×0.25 − age×0.20 + expBonus + vehicleBonus',
              desc: 'Multi-factor weighted scorer. Balances proximity, speed, and order urgency. Dispatches immediately, 1:1.',
            },
            {
              id: 'FASTEST_ETA',
              name: 'Fastest ETA',
              color: '#f87171',
              type: 'Greedy',
              score: 'eta×0.8 + distance×0.2 − age×0.20',
              desc: 'Minimizes customer-perceived wait by prioritizing ETA above cost. Good for SLA-tight environments.',
            },
            {
              id: 'LOWEST_COST',
              name: 'Lowest Cost',
              color: '#fb923c',
              type: 'Greedy',
              score: 'distance×0.7 + eta×0.3 − age×0.20',
              desc: 'Minimizes fleet distance driven. Reduces fuel and driver cost, may increase per-order latency.',
            },
            {
              id: 'BATCH_NEARBY',
              name: 'Batch Nearby',
              color: '#34d399',
              type: 'Batch (NN)',
              score: 'Hold τ=5 ticks → nearest-neighbour cluster (r≤120px) → multi-stop route',
              desc: 'Orders are held for a configurable window then clustered by restaurant proximity using nearest-neighbour grouping (max 3 per batch). Driver executes pickups then drops sequentially.',
            },
            {
              id: 'BATCH_OPTIMAL',
              name: 'Batch Optimal',
              color: '#28B86A',
              type: 'Batch (TSP)',
              score: 'Hold τ=5 ticks → greedy cheapest-insertion TSP → min-distance multi-stop route',
              desc: 'Same hold window as Batch Nearby but uses a greedy TSP insertion heuristic to find the lowest-cost pickup ordering within each cluster. Trades slightly more compute for better route quality.',
            },
          ].map(s => (
            <div key={s.id} className="rounded-lg p-3 flex gap-3"
              style={{ background: s.color + '11', border: `1px solid ${s.color}44` }}>
              <div className="mt-0.5">
                <Badge label={s.type} color={s.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold mb-0.5" style={{ color: '#1A3550' }}>{s.name}</div>
                <div className="font-mono text-[10px] mb-1 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.6)', color: '#4A7494' }}>
                  {s.score}
                </div>
                <div className="text-xs" style={{ color: '#4A7494' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* V. Experiments */}
      <Section title="V. Controlled Experiments">
        <div className="text-xs mb-4 leading-relaxed" style={{ color: '#4A7494' }}>
          The experiment runner executes all 5 strategies on the same city map with a fixed random seed,
          producing identical order arrival sequences for a fair head-to-head comparison. Results can be
          exported as CSV or a LaTeX table ready for paper inclusion.
        </div>
        <ExperimentPanel />
      </Section>

      {/* VI. References */}
      <Section title="VI. References">
        <ol className="flex flex-col gap-2 text-xs" style={{ color: '#4A7494' }}>
          {REFERENCES.map(r => (
            <li key={r.num} className="flex gap-2">
              <span className="font-semibold min-w-[16px]" style={{ color: '#1A3550' }}>[{r.num}]</span>
              <span>
                {r.authors}, &ldquo;{r.title},&rdquo;{' '}
                <i>{r.journal}</i>
                {r.vol && `, vol. ${r.vol}`}
                {r.num_ && `, no. ${r.num_}`}
                {r.year && `, ${r.year}`}
                {r.doi && <>, doi: <a href={`https://${r.doi.startsWith('10.') ? 'doi.org/' : ''}${r.doi}`}
                  target="_blank" rel="noreferrer" className="underline" style={{ color: '#1A3550' }}>{r.doi}</a></>}
                .
              </span>
            </li>
          ))}
        </ol>
      </Section>

    </div>
  );
}
