import { useState, useEffect, useCallback } from 'react';
import Sidebar, { type TabId } from './Sidebar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { usePlatformStore } from '../../store/platformStore';
import { api } from '../../services/api';

import MarketplaceTab  from './tabs/MarketplaceTab';
import OrdersTab       from './tabs/OrdersTab';
import DriversTab      from './tabs/DriversTab';
import RestaurantsTab  from './tabs/RestaurantsTab';
import DispatchTab     from './tabs/DispatchTab';
import EventsTab       from './tabs/EventsTab';
import IncidentsTab    from './tabs/IncidentsTab';
import TracesTab       from './tabs/TracesTab';
import AnalyticsTab    from './tabs/AnalyticsTab';
import AboutTab        from './tabs/AboutTab';

export default function AdminShell() {
  const [tab, setTab] = useState<TabId>('marketplace');
  const simulation = usePlatformStore(s => s.simulation);
  const connected  = usePlatformStore(s => s.connected);

  useWebSocket();

  useEffect(() => {
    api.simulation.getSnapshot().then(snap => {
      usePlatformStore.getState().applySnapshot(snap);
    }).catch(() => {});
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        simulation.running && !simulation.paused
          ? api.simulation.pause()
          : api.simulation.resume();
        break;
      case '1': api.simulation.setSpeed(1); break;
      case '2': api.simulation.setSpeed(2); break;
      case '3': api.simulation.setSpeed(5); break;
      case '4': api.simulation.setSpeed(10); break;
    }
  }, [simulation.running, simulation.paused]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const tabContent: Record<TabId, JSX.Element> = {
    marketplace: <MarketplaceTab />,
    orders:      <OrdersTab />,
    drivers:     <DriversTab />,
    restaurants: <RestaurantsTab />,
    dispatch:    <DispatchTab />,
    events:      <EventsTab />,
    incidents:   <IncidentsTab />,
    traces:      <TracesTab />,
    analytics:   <AnalyticsTab />,
    about:       <AboutTab />,
  };

  const drivers = usePlatformStore(s => s.drivers);
  const orders  = usePlatformStore(s => s.orders);

  const onlineDrivers = drivers.filter(d => d.status !== 'OFFLINE').length;
  const activeOrders  = orders.filter(o => o.status !== 'DELIVERED').length;
  const strategyLabel = simulation.dispatchStrategy === 'BALANCED'
    ? 'balanced'
    : simulation.dispatchStrategy.replace(/_/g, ' ').toLowerCase();

  const strategyPillLabel: Record<string, string> = {
    FASTEST_ETA: 'Fastest ETA',
    LOWEST_COST: 'Lowest Cost',
    BALANCED: 'Balanced',
    BATCH_NEARBY: 'Batch Nearby',
    BATCH_OPTIMAL: 'Batch Optimal',
  };
  const strategyDisplay = strategyPillLabel[simulation.dispatchStrategy]
    ?? simulation.dispatchStrategy.replace(/_/g, ' ');

  const isLive = connected && simulation.running && !simulation.paused;

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar activeTab={tab} onTabChange={setTab} />

      <div className="flex-1 flex flex-col min-w-0 content-area">

        {/* ── Floating header ── */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="glass-card flex items-center gap-3 px-5 py-3 text-[13px]" style={{ borderRadius: 16 }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="font-extrabold tracking-tight" style={{ color: '#172033', fontSize: 13 }}>
                Delivery Marketplace Control Plane
              </span>

              <span style={{ color: '#CBD5E1' }}>·</span>

              <span className="font-medium" style={{ color: '#475569' }}>
                {onlineDrivers} drivers · {activeOrders} active orders · {strategyLabel} dispatch
              </span>

              <div className="strategy-pill-premium">
                {strategyDisplay}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="clay-pill flex items-center gap-1.5 px-3 py-1.5" style={{ fontSize: 12 }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
                <span className="font-extrabold" style={{ color: '#16A34A' }}>{simulation.totalDeliveries}</span>
                <span className="font-medium" style={{ color: '#64748B' }}>Delivered</span>
              </div>

              <div className="clay-pill px-3 py-1.5" style={{ fontSize: 12 }}>
                <span className="font-medium" style={{ color: '#64748B' }}>Tick </span>
                <span className="font-extrabold" style={{ color: '#172033' }}>#{simulation.tickCount}</span>
              </div>

              <div className="clay-pill px-3 py-1.5" style={{ fontSize: 12 }}>
                <span className="font-medium" style={{ color: '#64748B' }}>Speed </span>
                <span className="font-extrabold" style={{ color: '#172033' }}>{simulation.speedMultiplier}×</span>
              </div>

              <div className="clay-pill flex items-center gap-1.5 px-3 py-1.5" style={{ fontSize: 12 }}>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${isLive ? 'live-pulse' : ''}`}
                  style={{
                    background: connected
                      ? simulation.running && !simulation.paused ? '#22C55E' : '#3B82F6'
                      : '#94A3B8',
                  }}
                />
                <span
                  className="font-bold"
                  style={{
                    color: connected
                      ? simulation.running && !simulation.paused ? '#16A34A' : simulation.paused ? '#F59E0B' : '#2563EB'
                      : '#64748B',
                  }}
                >
                  {connected
                    ? simulation.paused ? 'Paused'
                    : simulation.running ? 'Live'
                    : 'Ready'
                    : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-auto px-4 pb-4" style={{ minHeight: 0 }}>
          {tabContent[tab]}
        </div>

      </div>
    </div>
  );
}
