import { ROAD_NODES, ROAD_EDGES, BUILDINGS, CITY_ZONES } from '../../data/cityMap';
import type { Driver, Incident, Order, ZoneHeat } from '../../types';
import Roads from './Roads';
import BuildingMarkers from './BuildingMarkers';
import Vehicles from './Vehicles';
import ZoneOverlays from './ZoneOverlays';
import ActiveRoutes from './ActiveRoutes';

interface Props {
  drivers: Driver[];
  orders: Order[];
  zoneHeats: ZoneHeat[];
  incidents?: Incident[];
  selectedDriverId: string | null;
  selectedBuildingId: string | null;
  onSelectDriver: (id: string | null) => void;
  onSelectBuilding: (id: string | null) => void;
  quietMode?: boolean;
}

export default function CityMapSVG({
  drivers, orders, zoneHeats, incidents = [],
  selectedDriverId, selectedBuildingId,
  onSelectDriver, onSelectBuilding,
  quietMode = false,
}: Props) {
  return (
    <div className="w-full h-full overflow-hidden clay-map-canvas" style={{ borderRadius: 16, padding: 2 }}>
      <svg
        viewBox="80 30 1040 730"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ shapeRendering: 'geometricPrecision', borderRadius: 12 }}
        onClick={() => { onSelectDriver(null); onSelectBuilding(null); }}
      >
        <defs>
          <linearGradient id="map-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#EAF1F4" />
          </linearGradient>
          <pattern id="grid-fine" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="0.5" fill="rgba(100,116,139,0.04)" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="1200" height="800" fill="url(#map-bg)" rx="12" />
        <rect x="0" y="0" width="1200" height="800" fill="url(#grid-fine)" />

        <g id="layer-zones"><ZoneOverlays zones={CITY_ZONES} heats={zoneHeats} /></g>
        <g id="layer-roads"><Roads nodes={ROAD_NODES} edges={ROAD_EDGES} incidents={incidents} /></g>
        <g id="layer-routes"><ActiveRoutes drivers={drivers} orders={orders} /></g>
        <g id="layer-buildings">
          <BuildingMarkers buildings={BUILDINGS} orders={orders} selectedBuildingId={selectedBuildingId} onSelectBuilding={onSelectBuilding} />
        </g>
        <g id="layer-vehicles">
          <Vehicles drivers={drivers} orders={orders} selectedDriverId={selectedDriverId} onSelectDriver={onSelectDriver} quietMode={quietMode} />
        </g>
      </svg>
    </div>
  );
}
