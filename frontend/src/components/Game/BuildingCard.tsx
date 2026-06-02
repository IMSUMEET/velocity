import { X, MapPin, Package, Zap, Clock } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';

interface BuildingData {
  id: string;
  name: string;
  type: string;
  icon: string;
  zone: string;
  nodeId: string;
}

interface Props {
  building: BuildingData;
  pendingOrders: number;
  onClose: () => void;
}

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  restaurant: { bg: 'rgba(230,107,46,0.12)', color: '#E66B2E', label: 'Restaurant' },
  house: { bg: 'rgba(78,159,91,0.12)', color: '#4E9F5B', label: 'House' },
  apartment: { bg: 'rgba(78,159,91,0.12)', color: '#4E9F5B', label: 'Apartment' },
  office: { bg: 'rgba(77,139,184,0.12)', color: '#4D8BB8', label: 'Office' },
  shop: { bg: 'rgba(230,107,46,0.12)', color: '#E66B2E', label: 'Shop' },
  park: { bg: 'rgba(78,159,91,0.12)', color: '#4E9F5B', label: 'Park' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'New order', color: '#8A8A80' },
  FINDING_DRIVER: { label: 'Finding driver', color: '#C89B2E' },
  EN_ROUTE_PICKUP: { label: 'Driver coming', color: '#E66B2E' },
  WAITING_FOR_FOOD: { label: 'Cooking', color: '#C89B2E' },
  PICKED_UP: { label: 'Picked up', color: '#4E9F5B' },
  EN_ROUTE_DELIVERY: { label: 'Delivering', color: '#4D8BB8' },
  DELAYED: { label: 'Delayed!', color: '#C44B4B' },
};

export default function BuildingCard({ building, pendingOrders, onClose }: Props) {
  const typeStyle = TYPE_STYLES[building.type] ?? TYPE_STYLES.office;
  const orders = useSimulationStore(s => s.orders);
  const rushOrder = useSimulationStore(s => s.rushOrder);
  const incidents = useSimulationStore(s => s.incidents);

  const buildingOrders = orders.filter(
    o => o.restaurantNodeId === building.nodeId && !['DELIVERED'].includes(o.status)
  );

  const hasDelay = incidents.some(i => i.type === 'restaurant_delay' && i.affectedBuildingId === building.id);
  const cookingOrders = buildingOrders.filter(o => o.cookTimeRemaining !== undefined && o.cookTimeRemaining > 0);

  return (
    <div className="clay-card-sm p-4 pop-in" style={{ width: 270 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{building.icon}</span>
          <h4 className="font-bold text-sm truncate" style={{ fontFamily: "'Nunito'", color: '#1F2933' }}>
            {building.name}
          </h4>
        </div>
        <button onClick={onClose} className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 24, height: 24, background: '#F3EFE7', border: 'none', cursor: 'pointer' }}>
          <X size={12} color="#5A5A5A" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: typeStyle.bg, color: typeStyle.color }}>
          {typeStyle.label}
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: '#5A5A5A' }}>
          <MapPin size={11} />
          <span className="font-medium">{building.zone}</span>
        </div>
        {hasDelay && (
          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#C44B4B' }}>
            ⏳ Kitchen delay
          </div>
        )}
      </div>

      {building.type === 'restaurant' && (
        <>
          {/* Kitchen status */}
          <div className="clay-inset rounded-xl px-3 py-2 mb-2.5 flex items-center gap-2"
            style={{ color: cookingOrders.length > 0 ? '#C89B2E' : '#8A8A80' }}>
            <Clock size={12} />
            <span className="text-[11px] font-semibold">
              {cookingOrders.length > 0
                ? `${cookingOrders.length} order${cookingOrders.length > 1 ? 's' : ''} cooking`
                : 'Kitchen idle'}
            </span>
          </div>

          {/* Order queue */}
          {buildingOrders.length > 0 && (
            <div>
              <p className="text-[10px] font-bold mb-1.5" style={{ color: '#8A8A80' }}>Order Queue</p>
              <div className="flex flex-col gap-1">
                {buildingOrders.slice(0, 5).map(o => {
                  const isRushed = o.priority >= 10;
                  const canRush = ['CREATED', 'FINDING_DRIVER'].includes(o.status) && !isRushed;
                  const moodEmoji = o.mood === 'HAPPY' ? '😊' : o.mood === 'WAITING' ? '😐' : o.mood === 'FRUSTRATED' ? '😠' : '😡';
                  const statusInfo = STATUS_LABELS[o.status] ?? { label: o.status, color: '#8A8A80' };

                  return (
                    <div key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px]"
                      style={{ background: isRushed ? 'rgba(230,107,46,0.08)' : 'rgba(243,239,231,0.5)' }}>
                      <span>{moodEmoji}</span>
                      <span className="flex-1 truncate font-medium" style={{ color: '#1F2933' }}>
                        {o.customerName}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}>
                        {statusInfo.label}
                      </span>
                      {canRush && (
                        <button onClick={() => rushOrder(o.id)}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-bold text-white"
                          style={{ background: '#E66B2E', border: 'none', cursor: 'pointer' }}>
                          <Zap size={9} /> Rush
                        </button>
                      )}
                      {isRushed && (
                        <span className="text-[10px] font-bold" style={{ color: '#E66B2E' }}>⚡</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
