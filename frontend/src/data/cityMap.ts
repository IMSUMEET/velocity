export type ZoneName = 'Downtown' | 'Market District' | 'University Row' | 'Harbor Point' | 'Capitol Heights' | 'Stadium District';
export type BuildingType = 'restaurant' | 'house' | 'apartment' | 'office' | 'shop' | 'park';

export interface RoadNode {
  id: string;
  x: number;
  y: number;
  name?: string;
  zone: ZoneName;
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  speedLimit: number;
  congestion: number;
  isMajor: boolean;
}

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  nodeId: string;
  x: number;
  y: number;
  zone: ZoneName;
  icon: string;
}

export interface CityZone {
  id: string;
  name: ZoneName;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  labelX: number;
  labelY: number;
}

export const CITY_ZONES: CityZone[] = [
  { id: 'z1', name: 'Downtown', centerX: 580, centerY: 400, radius: 160, color: '#F97360', labelX: 580, labelY: 260 },
  { id: 'z2', name: 'Market District', centerX: 220, centerY: 340, radius: 140, color: '#F59E0B', labelX: 220, labelY: 218 },
  { id: 'z3', name: 'University Row', centerX: 900, centerY: 200, radius: 140, color: '#8B5CF6', labelX: 900, labelY: 78 },
  { id: 'z4', name: 'Harbor Point', centerX: 850, centerY: 650, radius: 140, color: '#3B6FF5', labelX: 850, labelY: 528 },
  { id: 'z5', name: 'Capitol Heights', centerX: 500, centerY: 150, radius: 130, color: '#22C55E', labelX: 500, labelY: 38 },
  { id: 'z6', name: 'Stadium District', centerX: 250, centerY: 620, radius: 130, color: '#EC4899', labelX: 250, labelY: 508 },
];

export const ROAD_NODES: RoadNode[] = [
  // Downtown (dense grid, center of map)
  { id: 'dt-1', x: 500, y: 370, name: '1st & Pike', zone: 'Downtown' },
  { id: 'dt-2', x: 560, y: 370, zone: 'Downtown' },
  { id: 'dt-3', x: 620, y: 370, name: '3rd & Pike', zone: 'Downtown' },
  { id: 'dt-4', x: 680, y: 370, zone: 'Downtown' },
  { id: 'dt-5', x: 500, y: 420, zone: 'Downtown' },
  { id: 'dt-6', x: 560, y: 420, name: '2nd & Union', zone: 'Downtown' },
  { id: 'dt-7', x: 620, y: 420, zone: 'Downtown' },
  { id: 'dt-8', x: 680, y: 420, zone: 'Downtown' },
  { id: 'dt-9', x: 500, y: 470, zone: 'Downtown' },
  { id: 'dt-10', x: 560, y: 470, name: '2nd & Madison', zone: 'Downtown' },
  { id: 'dt-11', x: 620, y: 470, zone: 'Downtown' },
  { id: 'dt-12', x: 680, y: 470, zone: 'Downtown' },

  // Market District (west)
  { id: 'mk-1', x: 150, y: 300, name: 'Market St', zone: 'Market District' },
  { id: 'mk-2', x: 220, y: 300, zone: 'Market District' },
  { id: 'mk-3', x: 290, y: 300, zone: 'Market District' },
  { id: 'mk-4', x: 150, y: 350, zone: 'Market District' },
  { id: 'mk-5', x: 220, y: 350, name: 'Market Square', zone: 'Market District' },
  { id: 'mk-6', x: 290, y: 350, zone: 'Market District' },
  { id: 'mk-7', x: 150, y: 400, zone: 'Market District' },
  { id: 'mk-8', x: 220, y: 400, zone: 'Market District' },
  { id: 'mk-9', x: 290, y: 400, zone: 'Market District' },

  // University Row (northeast)
  { id: 'ur-1', x: 830, y: 160, name: 'Campus Dr', zone: 'University Row' },
  { id: 'ur-2', x: 900, y: 160, zone: 'University Row' },
  { id: 'ur-3', x: 970, y: 160, zone: 'University Row' },
  { id: 'ur-4', x: 830, y: 220, zone: 'University Row' },
  { id: 'ur-5', x: 900, y: 220, name: 'University Ave', zone: 'University Row' },
  { id: 'ur-6', x: 970, y: 220, zone: 'University Row' },
  { id: 'ur-7', x: 830, y: 280, zone: 'University Row' },
  { id: 'ur-8', x: 900, y: 280, zone: 'University Row' },

  // Harbor Point (south/southeast)
  { id: 'hp-1', x: 780, y: 610, name: 'Harbor Dr', zone: 'Harbor Point' },
  { id: 'hp-2', x: 850, y: 610, zone: 'Harbor Point' },
  { id: 'hp-3', x: 920, y: 610, zone: 'Harbor Point' },
  { id: 'hp-4', x: 780, y: 670, zone: 'Harbor Point' },
  { id: 'hp-5', x: 850, y: 670, name: 'Harbor Plaza', zone: 'Harbor Point' },
  { id: 'hp-6', x: 920, y: 670, zone: 'Harbor Point' },
  { id: 'hp-7', x: 780, y: 730, zone: 'Harbor Point' },
  { id: 'hp-8', x: 850, y: 730, zone: 'Harbor Point' },

  // Capitol Heights (north)
  { id: 'ch-1', x: 430, y: 110, name: 'Heights Blvd', zone: 'Capitol Heights' },
  { id: 'ch-2', x: 500, y: 110, zone: 'Capitol Heights' },
  { id: 'ch-3', x: 570, y: 110, zone: 'Capitol Heights' },
  { id: 'ch-4', x: 430, y: 170, zone: 'Capitol Heights' },
  { id: 'ch-5', x: 500, y: 170, name: 'Capitol Ave', zone: 'Capitol Heights' },
  { id: 'ch-6', x: 570, y: 170, zone: 'Capitol Heights' },
  { id: 'ch-7', x: 430, y: 230, zone: 'Capitol Heights' },
  { id: 'ch-8', x: 500, y: 230, zone: 'Capitol Heights' },

  // Stadium District (southwest)
  { id: 'sd-1', x: 180, y: 580, name: 'Stadium Rd', zone: 'Stadium District' },
  { id: 'sd-2', x: 250, y: 580, zone: 'Stadium District' },
  { id: 'sd-3', x: 320, y: 580, zone: 'Stadium District' },
  { id: 'sd-4', x: 180, y: 640, zone: 'Stadium District' },
  { id: 'sd-5', x: 250, y: 640, name: 'Stadium Plaza', zone: 'Stadium District' },
  { id: 'sd-6', x: 320, y: 640, zone: 'Stadium District' },
  { id: 'sd-7', x: 180, y: 700, zone: 'Stadium District' },
  { id: 'sd-8', x: 250, y: 700, zone: 'Stadium District' },

  // Connector nodes (arterials between zones)
  { id: 'cn-1', x: 370, y: 300, zone: 'Market District' },
  { id: 'cn-2', x: 430, y: 370, zone: 'Downtown' },
  { id: 'cn-3', x: 430, y: 300, zone: 'Capitol Heights' },
  { id: 'cn-4', x: 680, y: 300, zone: 'Downtown' },
  { id: 'cn-5', x: 750, y: 300, zone: 'University Row' },
  { id: 'cn-6', x: 680, y: 530, zone: 'Downtown' },
  { id: 'cn-7', x: 750, y: 530, zone: 'Harbor Point' },
  { id: 'cn-8', x: 400, y: 500, zone: 'Stadium District' },
  { id: 'cn-9', x: 350, y: 520, zone: 'Stadium District' },
  { id: 'cn-10', x: 560, y: 530, zone: 'Downtown' },
];

function dist(n1: RoadNode, n2: RoadNode): number {
  return Math.round(Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2));
}

const nodeMap = new Map(ROAD_NODES.map(n => [n.id, n]));

function edge(id: string, from: string, to: string, speedLimit: number, congestion: number, isMajor: boolean): RoadEdge {
  const n1 = nodeMap.get(from)!;
  const n2 = nodeMap.get(to)!;
  return { id, from, to, distance: dist(n1, n2), speedLimit, congestion, isMajor };
}

export const ROAD_EDGES: RoadEdge[] = [
  // Downtown grid (dense)
  edge('e1', 'dt-1', 'dt-2', 4, 0.4, true),
  edge('e2', 'dt-2', 'dt-3', 4, 0.5, true),
  edge('e3', 'dt-3', 'dt-4', 4, 0.3, true),
  edge('e4', 'dt-5', 'dt-6', 3, 0.6, false),
  edge('e5', 'dt-6', 'dt-7', 3, 0.5, false),
  edge('e6', 'dt-7', 'dt-8', 3, 0.4, false),
  edge('e7', 'dt-9', 'dt-10', 3, 0.3, false),
  edge('e8', 'dt-10', 'dt-11', 3, 0.4, false),
  edge('e9', 'dt-11', 'dt-12', 3, 0.3, false),
  edge('e10', 'dt-1', 'dt-5', 4, 0.4, true),
  edge('e11', 'dt-5', 'dt-9', 4, 0.3, true),
  edge('e12', 'dt-2', 'dt-6', 3, 0.5, false),
  edge('e13', 'dt-6', 'dt-10', 3, 0.4, false),
  edge('e14', 'dt-3', 'dt-7', 3, 0.4, false),
  edge('e15', 'dt-7', 'dt-11', 3, 0.3, false),
  edge('e16', 'dt-4', 'dt-8', 4, 0.3, true),
  edge('e17', 'dt-8', 'dt-12', 4, 0.4, true),

  // Market District grid
  edge('e18', 'mk-1', 'mk-2', 3, 0.2, true),
  edge('e19', 'mk-2', 'mk-3', 3, 0.2, false),
  edge('e20', 'mk-4', 'mk-5', 3, 0.3, false),
  edge('e21', 'mk-5', 'mk-6', 3, 0.2, false),
  edge('e22', 'mk-7', 'mk-8', 2, 0.2, false),
  edge('e23', 'mk-8', 'mk-9', 2, 0.2, false),
  edge('e24', 'mk-1', 'mk-4', 3, 0.2, false),
  edge('e25', 'mk-4', 'mk-7', 2, 0.2, false),
  edge('e26', 'mk-2', 'mk-5', 3, 0.3, true),
  edge('e27', 'mk-5', 'mk-8', 2, 0.2, false),
  edge('e28', 'mk-3', 'mk-6', 3, 0.2, false),
  edge('e29', 'mk-6', 'mk-9', 2, 0.2, false),

  // University Row grid
  edge('e30', 'ur-1', 'ur-2', 3, 0.2, true),
  edge('e31', 'ur-2', 'ur-3', 3, 0.2, false),
  edge('e32', 'ur-4', 'ur-5', 3, 0.3, false),
  edge('e33', 'ur-5', 'ur-6', 3, 0.2, false),
  edge('e34', 'ur-7', 'ur-8', 2, 0.2, false),
  edge('e35', 'ur-1', 'ur-4', 3, 0.2, true),
  edge('e36', 'ur-4', 'ur-7', 2, 0.2, false),
  edge('e37', 'ur-2', 'ur-5', 3, 0.3, false),
  edge('e38', 'ur-5', 'ur-8', 2, 0.2, false),
  edge('e39', 'ur-3', 'ur-6', 3, 0.2, false),

  // Harbor Point grid
  edge('e40', 'hp-1', 'hp-2', 3, 0.2, true),
  edge('e41', 'hp-2', 'hp-3', 3, 0.2, false),
  edge('e42', 'hp-4', 'hp-5', 3, 0.3, false),
  edge('e43', 'hp-5', 'hp-6', 3, 0.2, false),
  edge('e44', 'hp-7', 'hp-8', 2, 0.2, false),
  edge('e45', 'hp-1', 'hp-4', 3, 0.2, false),
  edge('e46', 'hp-4', 'hp-7', 2, 0.2, false),
  edge('e47', 'hp-2', 'hp-5', 3, 0.2, true),
  edge('e48', 'hp-5', 'hp-8', 2, 0.2, false),
  edge('e49', 'hp-3', 'hp-6', 3, 0.2, false),

  // Capitol Heights grid
  edge('e50', 'ch-1', 'ch-2', 3, 0.2, true),
  edge('e51', 'ch-2', 'ch-3', 3, 0.2, false),
  edge('e52', 'ch-4', 'ch-5', 3, 0.3, false),
  edge('e53', 'ch-5', 'ch-6', 3, 0.2, false),
  edge('e54', 'ch-7', 'ch-8', 2, 0.2, false),
  edge('e55', 'ch-1', 'ch-4', 3, 0.2, false),
  edge('e56', 'ch-4', 'ch-7', 2, 0.2, false),
  edge('e57', 'ch-2', 'ch-5', 3, 0.3, true),
  edge('e58', 'ch-5', 'ch-8', 2, 0.2, false),
  edge('e59', 'ch-3', 'ch-6', 3, 0.2, false),

  // Stadium District grid
  edge('e60', 'sd-1', 'sd-2', 3, 0.2, true),
  edge('e61', 'sd-2', 'sd-3', 3, 0.2, false),
  edge('e62', 'sd-4', 'sd-5', 3, 0.3, false),
  edge('e63', 'sd-5', 'sd-6', 3, 0.2, false),
  edge('e64', 'sd-7', 'sd-8', 2, 0.2, false),
  edge('e65', 'sd-1', 'sd-4', 3, 0.2, false),
  edge('e66', 'sd-4', 'sd-7', 2, 0.2, false),
  edge('e67', 'sd-2', 'sd-5', 3, 0.2, true),
  edge('e68', 'sd-5', 'sd-8', 2, 0.2, false),
  edge('e69', 'sd-3', 'sd-6', 3, 0.2, false),

  // === Inter-zone connectors (major arterials) ===
  // Market District → Downtown
  edge('e70', 'mk-3', 'cn-1', 4, 0.3, true),
  edge('e71', 'cn-1', 'cn-3', 4, 0.3, true),
  edge('e72', 'cn-3', 'cn-2', 4, 0.4, true),
  edge('e73', 'cn-2', 'dt-1', 4, 0.5, true),
  edge('e74', 'mk-9', 'cn-8', 4, 0.3, true),

  // Capitol Heights → Downtown
  edge('e75', 'ch-7', 'cn-3', 4, 0.3, true),
  edge('e76', 'ch-8', 'dt-1', 5, 0.4, true),

  // Downtown → University Row
  edge('e77', 'dt-4', 'cn-4', 4, 0.4, true),
  edge('e78', 'cn-4', 'cn-5', 4, 0.3, true),
  edge('e79', 'cn-5', 'ur-7', 4, 0.3, true),

  // Downtown → Harbor Point
  edge('e80', 'dt-12', 'cn-6', 4, 0.3, true),
  edge('e81', 'cn-6', 'cn-7', 4, 0.3, true),
  edge('e82', 'cn-7', 'hp-1', 4, 0.3, true),

  // Downtown → Stadium District
  edge('e83', 'dt-9', 'cn-8', 4, 0.4, true),
  edge('e84', 'cn-8', 'cn-9', 3, 0.3, false),
  edge('e85', 'cn-9', 'sd-3', 4, 0.3, true),

  // Downtown south connector
  edge('e86', 'dt-10', 'cn-10', 3, 0.3, false),
  edge('e87', 'cn-10', 'cn-6', 3, 0.3, false),

  // Market District → Capitol Heights
  edge('e88', 'mk-2', 'ch-1', 5, 0.2, true),

  // Market District → Stadium District
  edge('e89', 'mk-7', 'sd-1', 5, 0.2, true),

  // University Row → Harbor Point  
  edge('e90', 'ur-8', 'cn-5', 3, 0.2, false),
  edge('e91', 'cn-4', 'cn-6', 5, 0.3, true),

  // Harbor Point → Stadium District (long southern route)
  edge('e92', 'hp-7', 'hp-8', 2, 0.2, false),
  edge('e93', 'sd-6', 'cn-10', 4, 0.3, true),
];

export const BUILDINGS: Building[] = [
  // Restaurants
  { id: 'b1', name: 'Pike Street Pizza', type: 'restaurant', nodeId: 'dt-1', x: 488, y: 358, zone: 'Downtown', icon: '🍕' },
  { id: 'b2', name: 'Rainier Coffee House', type: 'restaurant', nodeId: 'mk-5', x: 232, y: 338, zone: 'Market District', icon: '☕' },
  { id: 'b3', name: 'Harbor Sushi', type: 'restaurant', nodeId: 'hp-2', x: 862, y: 598, zone: 'Harbor Point', icon: '🍣' },
  { id: 'b4', name: 'Capitol Grill', type: 'restaurant', nodeId: 'ch-5', x: 512, y: 158, zone: 'Capitol Heights', icon: '🥩' },
  { id: 'b5', name: 'Stadium Burgers', type: 'restaurant', nodeId: 'sd-2', x: 262, y: 568, zone: 'Stadium District', icon: '🍔' },
  { id: 'b6', name: 'Campus Tacos', type: 'restaurant', nodeId: 'ur-5', x: 912, y: 208, zone: 'University Row', icon: '🌮' },
  { id: 'b7', name: 'Faculty Lounge', type: 'restaurant', nodeId: 'ur-2', x: 888, y: 148, zone: 'University Row', icon: '🍽️' },
  { id: 'b8', name: 'Din Tai Fung', type: 'restaurant', nodeId: 'dt-3', x: 632, y: 358, zone: 'Downtown', icon: '🥟' },
  { id: 'b9', name: 'Wild Ginger', type: 'restaurant', nodeId: 'dt-6', x: 548, y: 408, zone: 'Downtown', icon: '🍜' },
  { id: 'b10', name: 'Japonessa', type: 'restaurant', nodeId: 'dt-7', x: 632, y: 432, zone: 'Downtown', icon: '🍱' },

  // Houses & Apartments
  { id: 'b11', name: 'Aurora Apartments', type: 'apartment', nodeId: 'ch-4', x: 418, y: 182, zone: 'Capitol Heights', icon: '🏢' },
  { id: 'b12', name: 'Skyline Condos', type: 'apartment', nodeId: 'dt-8', x: 692, y: 408, zone: 'Downtown', icon: '🏢' },
  { id: 'b13', name: 'Bayview Residence', type: 'house', nodeId: 'hp-4', x: 768, y: 682, zone: 'Harbor Point', icon: '🏠' },
  { id: 'b14', name: 'Riverside Apartments', type: 'apartment', nodeId: 'sd-5', x: 238, y: 652, zone: 'Stadium District', icon: '🏢' },
  { id: 'b15', name: 'Hilltop House', type: 'house', nodeId: 'ch-2', x: 512, y: 98, zone: 'Capitol Heights', icon: '🏡' },
  { id: 'b16', name: 'Harbor View Apts', type: 'apartment', nodeId: 'hp-5', x: 862, y: 658, zone: 'Harbor Point', icon: '🏢' },
  { id: 'b17', name: 'Elm Cottage', type: 'house', nodeId: 'mk-7', x: 138, y: 412, zone: 'Market District', icon: '🏡' },
  { id: 'b18', name: 'Campus Housing', type: 'apartment', nodeId: 'ur-6', x: 982, y: 208, zone: 'University Row', icon: '🏢' },

  // Offices
  { id: 'b19', name: 'Union Office Tower', type: 'office', nodeId: 'dt-10', x: 572, y: 458, zone: 'Downtown', icon: '🏛️' },
  { id: 'b20', name: 'Tech Hub Offices', type: 'office', nodeId: 'ur-4', x: 818, y: 232, zone: 'University Row', icon: '🏦' },
  { id: 'b21', name: 'Harbor Warehouse', type: 'office', nodeId: 'hp-6', x: 932, y: 658, zone: 'Harbor Point', icon: '🏭' },

  // Shops
  { id: 'b22', name: 'Green Market', type: 'shop', nodeId: 'mk-2', x: 232, y: 288, zone: 'Market District', icon: '🛒' },
  { id: 'b23', name: 'Central Pharmacy', type: 'shop', nodeId: 'dt-2', x: 548, y: 358, zone: 'Downtown', icon: '💊' },
  { id: 'b24', name: 'Pioneer Books', type: 'shop', nodeId: 'mk-4', x: 138, y: 338, zone: 'Market District', icon: '📚' },

  // Parks
  { id: 'b25', name: 'Velocity Park', type: 'park', nodeId: 'dt-11', x: 632, y: 482, zone: 'Downtown', icon: '🌳' },
  { id: 'b26', name: 'Heights Garden', type: 'park', nodeId: 'ch-6', x: 582, y: 158, zone: 'Capitol Heights', icon: '🌲' },
];

export const BUILDING_COLORS: Record<BuildingType, string> = {
  restaurant: '#ff6b35',
  house: '#60a5fa',
  apartment: '#60a5fa',
  office: '#a78bfa',
  shop: '#fbbf24',
  park: '#34d399',
};

export function getNodeById(id: string): RoadNode | undefined {
  return nodeMap.get(id);
}

// Pre-compute adjacency list for pathfinding
export const ROAD_ADJACENCY: Map<string, { nodeId: string; edgeId: string; cost: number }[]> = (() => {
  const adj = new Map<string, { nodeId: string; edgeId: string; cost: number }[]>();

  for (const node of ROAD_NODES) {
    adj.set(node.id, []);
  }

  for (const e of ROAD_EDGES) {
    const cost = e.distance * (1 + e.congestion) / Math.max(e.speedLimit, 1);
    adj.get(e.from)?.push({ nodeId: e.to, edgeId: e.id, cost });
    adj.get(e.to)?.push({ nodeId: e.from, edgeId: e.id, cost });
  }

  return adj;
})();
