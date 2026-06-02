import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSimulationStore } from '../../store/simulationStore';
import { CITY_ZONES } from '../../data/cityMap';

export default function BottomDock() {
  const [relocateOpen, setRelocateOpen] = useState(false);
  const deployDriver = useSimulationStore(s => s.deployDriver);
  const relocateToZone = useSimulationStore(s => s.relocateToZone);
  const rushDelayed = useSimulationStore(s => s.rushDelayed);
  const drivers = useSimulationStore(s => s.drivers);
  const metrics = useSimulationStore(s => s.metrics);

  const totalDrivers = drivers.filter(d => d.status !== 'OFFLINE').length;
  const idleDrivers = drivers.filter(d => d.status === 'IDLE').length;

  return (
    <div className="flex justify-center">
      <div className="relative">
        <AnimatePresence>
          {relocateOpen && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="clay-card-sm absolute bottom-full mb-2 left-1/2 -translate-x-1/2 p-3" style={{ minWidth: 280 }}>
              <p className="text-[10px] font-bold mb-1 text-center" style={{ color: '#1F2933' }}>Relocate idle drivers to zone</p>
              <p className="text-[9px] mb-2 text-center" style={{ color: '#8A8A80' }}>{idleDrivers} driver{idleDrivers !== 1 ? 's' : ''} available</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {CITY_ZONES.map(z => (
                  <button key={z.id} onClick={() => { relocateToZone(z.name); setRelocateOpen(false); }}
                    className="clay-btn px-2.5 py-1.5 text-[10px] font-semibold" style={{ background: '#FFF8ED', color: '#252525' }}>
                    {z.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="clay-card flex items-center gap-1.5 px-3 py-2" style={{ borderRadius: 20 }}>
          {/* Deploy buttons */}
          <button onClick={() => deployDriver('BIKE')}
            className="clay-btn flex items-center gap-1.5 px-3 py-2 font-semibold text-xs text-white"
            style={{ background: '#4E9F5B' }}>
            <span className="text-sm">🏍️</span>
            <span className="hidden sm:inline">Deploy Bike</span>
            <span className="text-[8px] opacity-40 font-mono px-0.5 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>B</span>
          </button>
          <button onClick={() => deployDriver('CAR')}
            className="clay-btn flex items-center gap-1.5 px-3 py-2 font-semibold text-xs text-white"
            style={{ background: '#4D8BB8' }}>
            <span className="text-sm">🚗</span>
            <span className="hidden sm:inline">Deploy Car</span>
            <span className="text-[8px] opacity-40 font-mono px-0.5 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>C</span>
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(37,37,37,0.08)' }} />

          {/* Operational actions */}
          <button onClick={() => setRelocateOpen(prev => !prev)}
            className="clay-btn flex items-center gap-1.5 px-3 py-2 font-semibold text-xs text-white"
            style={{ background: '#E66B2E', opacity: idleDrivers === 0 ? 0.5 : 1 }}>
            <span className="text-sm">📍</span>
            <span className="hidden sm:inline">Relocate</span>
          </button>

          <button onClick={rushDelayed}
            className="clay-btn flex items-center gap-1.5 px-3 py-2 font-semibold text-xs text-white"
            style={{ background: metrics.delayedOrders > 0 ? '#C44B4B' : '#8A8A80' }}>
            <span className="text-sm">🚨</span>
            <span className="hidden sm:inline">Rush Delayed</span>
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(37,37,37,0.08)' }} />

          {/* Fleet counter */}
          <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold" style={{ color: '#5A5A5A' }}>Fleet: {totalDrivers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
