import { X, Star, Package, Zap, ArrowLeft, Rocket, Coffee } from 'lucide-react';
import type { Driver, Order } from '../../types';
import { useSimulationStore } from '../../store/simulationStore';

interface Props {
  driver: Driver;
  order: Order | undefined;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  IDLE: { bg: 'rgba(78,159,91,0.12)', color: '#4E9F5B', label: 'Available' },
  EN_ROUTE_PICKUP: { bg: 'rgba(230,107,46,0.12)', color: '#E66B2E', label: 'Going to restaurant' },
  WAITING_AT_RESTAURANT: { bg: 'rgba(200,155,46,0.12)', color: '#C89B2E', label: 'Waiting for food' },
  DELIVERING: { bg: 'rgba(77,139,184,0.12)', color: '#4D8BB8', label: 'Delivering to customer' },
  ON_BREAK: { bg: 'rgba(138,138,128,0.12)', color: '#8A8A80', label: 'On break' },
  OFFLINE: { bg: 'rgba(138,138,128,0.1)', color: '#8A8A80', label: 'Offline' },
};

const PIPELINE_STEPS = ['EN_ROUTE_PICKUP', 'WAITING_AT_RESTAURANT', 'DELIVERING'] as const;
const PIPELINE_LABELS = ['🏍️ To Restaurant', '🍳 Waiting for Food', '📦 To Customer'] as const;

export default function DriverCard({ driver, order, onClose }: Props) {
  const statusStyle = STATUS_STYLES[driver.status] ?? STATUS_STYLES.IDLE;
  const vehicleEmoji = driver.vehicleType === 'CAR' ? '🚗' : '🏍️';
  const boostDriver = useSimulationStore(s => s.boostDriver);
  const recallDriver = useSimulationStore(s => s.recallDriver);
  const manualAssign = useSimulationStore(s => s.manualAssign);
  const orders = useSimulationStore(s => s.orders);
  const pendingOrders = orders.filter(o => o.status === 'CREATED' || o.status === 'FINDING_DRIVER').slice(0, 3);

  const isBoosted = driver.speed > 1.3;
  const isActive = ['EN_ROUTE_PICKUP', 'WAITING_AT_RESTAURANT', 'DELIVERING'].includes(driver.status);
  const fatigueColor = driver.fatigue > 70 ? '#C44B4B' : driver.fatigue > 40 ? '#C89B2E' : '#4E9F5B';
  const currentStepIdx = PIPELINE_STEPS.indexOf(driver.status as any);

  return (
    <div className="clay-card-sm p-4 pop-in" style={{ width: 270 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{vehicleEmoji}</span>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate" style={{ fontFamily: "'Nunito'", color: '#1F2933' }}>{driver.name}</h4>
            {driver.statusDetail && (
              <p className="text-[10px] truncate" style={{ color: '#8A8A80' }}>{driver.statusDetail}</p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 24, height: 24, background: '#F3EFE7', border: 'none', cursor: 'pointer' }}>
          <X size={12} color="#5A5A5A" />
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: statusStyle.bg, color: statusStyle.color }}>
          {statusStyle.label}
        </div>
        {isBoosted && (
          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#E66B2E' }}>
            ⚡ Boosted
          </div>
        )}
      </div>

      {/* Delivery pipeline */}
      {isActive && order && (
        <div className="clay-inset rounded-xl px-3 py-2.5 mb-2.5">
          <p className="text-[10px] font-bold mb-2" style={{ color: '#8A8A80' }}>Delivery Pipeline</p>
          <div className="flex flex-col gap-1">
            {PIPELINE_STEPS.map((step, i) => {
              const isComplete = currentStepIdx > i;
              const isCurrent = currentStepIdx === i;
              return (
                <div key={step} className="flex items-center gap-2">
                  <div className="shrink-0" style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: isComplete ? '#4E9F5B' : isCurrent ? '#E66B2E' : 'rgba(37,37,37,0.1)',
                  }} />
                  <span className="text-[10px] font-medium" style={{
                    color: isCurrent ? '#1F2933' : isComplete ? '#4E9F5B' : '#8A8A80',
                    fontWeight: isCurrent ? 700 : 500,
                  }}>
                    {PIPELINE_LABELS[i]}
                  </span>
                </div>
              );
            })}
          </div>
          {order && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(37,37,37,0.06)' }}>
              <p className="text-[10px] font-medium" style={{ color: '#5A5A5A' }}>
                <Package size={10} className="inline mr-1" />{order.restaurantName} → {order.customerName}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs mb-2.5" style={{ color: '#5A5A5A' }}>
        <div className="flex items-center gap-1">
          <Star size={11} color="#E66B2E" fill="#E66B2E" />
          <span className="font-semibold">{driver.rating.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Package size={11} />
          <span className="font-semibold">{driver.totalDeliveries}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={11} color="#4D8BB8" />
          <span className="font-semibold">{driver.speed.toFixed(1)}x</span>
        </div>
      </div>

      {/* Fatigue bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-semibold mb-1">
          <span style={{ color: '#8A8A80' }}>Energy</span>
          <span style={{ color: fatigueColor }}>{Math.max(0, 100 - driver.fatigue)}%</span>
        </div>
        <div className="clay-inset overflow-hidden" style={{ height: 5, borderRadius: 3 }}>
          <div style={{
            width: `${Math.max(0, 100 - driver.fatigue)}%`, height: '100%', borderRadius: 3,
            background: fatigueColor, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        {isActive && (
          <div className="flex gap-1.5">
            {!isBoosted && (
              <button onClick={() => boostDriver(driver.id)}
                className="clay-btn flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-white"
                style={{ background: '#E66B2E' }}>
                <Rocket size={12} /> Incentivize
              </button>
            )}
            <button onClick={() => { recallDriver(driver.id); onClose(); }}
              className="clay-btn flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold"
              style={{ background: '#FFF8ED', color: '#C44B4B' }}>
              <ArrowLeft size={12} /> Recall
            </button>
          </div>
        )}

        {driver.status === 'ON_BREAK' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(138,138,128,0.08)' }}>
            <Coffee size={12} color="#8A8A80" />
            <span className="text-[11px] font-medium" style={{ color: '#8A8A80' }}>Resting — will be back soon</span>
          </div>
        )}

        {driver.status === 'IDLE' && pendingOrders.length > 0 && (
          <div>
            <p className="text-[10px] font-bold mb-1" style={{ color: '#8A8A80' }}>Assign to order:</p>
            <div className="flex flex-col gap-1">
              {pendingOrders.map(o => (
                <button key={o.id} onClick={() => { manualAssign(driver.id, o.id); onClose(); }}
                  className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-left"
                  style={{ background: '#FFF8ED', color: '#1F2933' }}>
                  <span>📦</span>
                  <span className="truncate">{o.restaurantName} → {o.customerName}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
