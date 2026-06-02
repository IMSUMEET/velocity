import {
  LayoutDashboard, Package, Truck, ChefHat, Zap,
  Radio, AlertTriangle, GitBranch, BarChart3, BookOpen,
  ChevronRight,
} from 'lucide-react';

export type TabId =
  | 'marketplace' | 'orders' | 'drivers' | 'restaurants'
  | 'dispatch' | 'events' | 'incidents' | 'traces' | 'analytics' | 'about';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: 'marketplace', label: 'Marketplace',     icon: LayoutDashboard, group: 'OBSERVE' },
  { id: 'orders',      label: 'Orders',          icon: Package },
  { id: 'drivers',     label: 'Drivers',         icon: Truck },
  { id: 'restaurants', label: 'Restaurants',     icon: ChefHat },
  { id: 'dispatch',    label: 'Dispatch Engine', icon: Zap,           group: 'CONTROL' },
  { id: 'incidents',   label: 'Incidents',       icon: AlertTriangle },
  { id: 'analytics',   label: 'Analytics',       icon: BarChart3,     group: 'ANALYZE' },
  { id: 'events',      label: 'Events & Queues', icon: Radio },
  { id: 'traces',      label: 'Traces',          icon: GitBranch },
  { id: 'about',       label: 'About',            icon: BookOpen,      group: 'INFO' },
];

const ICON_TINT: Partial<Record<TabId, string>> = {
  marketplace: '#2563EB',
  orders: '#14B8A6',
  drivers: '#22C55E',
  restaurants: '#F97316',
  dispatch: '#8B5CF6',
  incidents: '#EF4444',
  analytics: '#3B6FF5',
};

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <div
      className="flex flex-col clay-surface"
      style={{ width: 252, flexShrink: 0, overflow: 'hidden' }}
    >
      <div
        className="px-5 pt-6 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(71,85,105,0.10)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="nav-icon-raised"
            style={{
              width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              background: 'linear-gradient(145deg, #FFFFFF, #EEF4F7)',
              boxShadow: '0 8px 20px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
              border: '1px solid rgba(37,99,235,0.14)',
            }}
          >
            🚴
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold" style={{ color: '#0F172A', letterSpacing: '-0.02em' }}>VeloCity</h1>
            <p className="text-[11px] font-semibold" style={{ color: '#64748B' }}>Delivery control plane</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 px-3 pb-3 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {TABS.map(({ id, label, icon: Icon, group }) => {
          const active = id === activeTab;
          const tint = ICON_TINT[id] ?? '#64748B';
          return (
            <div key={id}>
              {group && (
                <div
                  className="px-3 pt-4 pb-1.5 text-[11px] font-extrabold uppercase"
                  style={{ letterSpacing: '0.14em', color: '#64748B' }}
                >
                  {group}
                </div>
              )}
              <button
                onClick={() => onTabChange(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-semibold transition-all text-left ${active ? 'nav-item-active' : ''}`}
                style={{
                  borderRadius: 12,
                  background: active ? undefined : 'transparent',
                  border: active ? undefined : '1px solid transparent',
                  color: active ? '#2563EB' : '#475569',
                }}
              >
                <div
                  className={active ? 'nav-icon-raised' : ''}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: active ? undefined : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2.3 : 1.8} style={{ color: active ? tint : '#64748B' }} />
                </div>
                <span style={{ flex: 1 }}>{label}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mx-3 mb-3 flex-shrink-0 clay-card-sm" style={{ padding: '12px 14px', border: '1px solid rgba(71,85,105,0.12)' }}>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(135deg, #2563EB, #14B8A6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: 14, fontWeight: 800,
            boxShadow: '3px 3px 10px rgba(37,99,235,0.20), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}>V</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold" style={{ color: '#0F172A' }}>VeloCity Ops</div>
            <div className="text-[10px] font-medium flex items-center gap-1.5" style={{ color: '#64748B' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
              Operations Team
            </div>
          </div>
          <div className="clay-inset" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={13} style={{ color: '#64748B' }} />
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center gap-1.5 text-[10px] font-medium flex-shrink-0" style={{ color: '#64748B' }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
        Live operations workspace
      </div>
    </div>
  );
}
