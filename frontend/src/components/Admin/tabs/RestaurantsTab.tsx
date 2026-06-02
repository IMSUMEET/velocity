import { usePlatformStore } from '../../../store/platformStore';
import { BUILDINGS } from '../../../data/cityMap';

export default function RestaurantsTab() {
  const orders    = usePlatformStore(s => s.orders);
  const incidents = usePlatformStore(s => s.incidents);
  const restaurants = BUILDINGS.filter(b => b.type === 'restaurant');

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-3 gap-3">
          {restaurants.map(r => {
            const activeOrders  = orders.filter(o => o.restaurantNodeId === r.nodeId && o.status !== 'DELIVERED');
            const waitingOrders = activeOrders.filter(o => o.status === 'WAITING_FOR_FOOD');
            const relatedIncident = incidents.find(i =>
              i.affectedBuildingId === r.id || (i.zone === r.zone && i.type === 'RESTAURANT_DELAY')
            );
            const avgPrepLeft = waitingOrders.length > 0
              ? (waitingOrders.reduce((s, o) => s + (o.cookTimeRemaining ?? 0), 0) / waitingOrders.length).toFixed(1)
              : '—';

            const busy = activeOrders.length > 3;

            return (
              <div
                key={r.id}
                style={{
                  background: 'linear-gradient(150deg,#FFFFFF 0%,#F4F8FC 100%)',
                  border: `1px solid ${relatedIncident ? 'rgba(249,115,96,0.28)' : 'rgba(255,255,255,0.88)'}`,
                  borderBottomColor: relatedIncident ? 'rgba(249,115,96,0.28)' : 'rgba(100,116,139,0.15)',
                  borderRightColor: relatedIncident ? 'rgba(249,115,96,0.28)' : 'rgba(100,116,139,0.12)',
                  borderRadius: 20,
                  padding: '16px',
                  boxShadow: relatedIncident
                    ? '0 0 0 2px rgba(249,115,96,0.10), 8px 8px 22px rgba(45,38,30,0.08)'
                    : '7px 7px 20px rgba(45,38,30,0.07), -7px -7px 20px rgba(255,250,242,0.48)',
                  transition: 'all 0.15s',
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: busy ? 'rgba(249,115,96,0.10)' : 'rgba(59,111,245,0.07)',
                    }}
                  >
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: '#1A3550' }}>{r.name}</div>
                    <div className="text-[10px] font-medium mt-0.5" style={{ color: '#6A8FA8' }}>
                      {r.zone}
                    </div>
                    {relatedIncident && (
                      <div
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold mt-1"
                        style={{ background: 'rgba(249,115,96,0.12)', color: '#C46B58' }}
                      >
                        ⚠ Incident
                      </div>
                    )}
                  </div>
                  {/* Status dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                    style={{
                      background: busy ? '#C46B58' : activeOrders.length > 0 ? '#C4923A' : '#28B86A',
                      boxShadow: `0 0 6px ${busy ? 'rgba(249,115,96,0.5)' : activeOrders.length > 0 ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.5)'}`,
                    }}
                  />
                </div>

                {/* Stats */}
                <div
                  className="grid grid-cols-3 gap-2 rounded-xl p-2.5 mb-3"
                  style={{ background: 'rgba(238,243,247,0.6)' }}
                >
                  {[
                    { label: 'Active',   value: activeOrders.length,  color: activeOrders.length > 3 ? '#C46B58' : '#1A3550' },
                    { label: 'Waiting',  value: waitingOrders.length, color: waitingOrders.length > 0 ? '#C4923A' : '#1A3550' },
                    { label: 'Avg Prep', value: avgPrepLeft,          color: '#1A3550' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <div className="text-[14px] font-extrabold" style={{ color }}>{value}</div>
                      <div className="text-[9px] font-medium mt-0.5" style={{ color: '#6A8FA8' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Incident banner */}
                {relatedIncident && (
                  <div
                    className="rounded-xl px-3 py-2 text-[10px] font-semibold"
                    style={{ background: 'rgba(249,115,96,0.10)', color: '#C46B58', border: '1px solid rgba(249,115,96,0.20)' }}
                  >
                    ⚡ {relatedIncident.title}: {relatedIncident.message}
                  </div>
                )}

                {/* Active order pills */}
                {activeOrders.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    {activeOrders.slice(0, 2).map(o => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between rounded-lg px-2 py-1 text-[10px]"
                        style={{ background: 'rgba(238,243,247,0.5)' }}
                      >
                        <span style={{ color: '#4A7494' }}>
                          #{o.id} {o.customerName}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                          style={{
                            background: o.status === 'WAITING_FOR_FOOD' ? 'rgba(245,158,11,0.15)' : 'rgba(59,111,245,0.12)',
                            color: o.status === 'WAITING_FOR_FOOD' ? '#C4923A' : '#0EA5E9',
                          }}
                        >
                          {o.status === 'WAITING_FOR_FOOD' ? '🍳 cooking' : o.status.replace(/_/g,' ').toLowerCase()}
                        </span>
                      </div>
                    ))}
                    {activeOrders.length > 2 && (
                      <div className="text-[9px] text-center" style={{ color: '#6A8FA8' }}>
                        +{activeOrders.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
