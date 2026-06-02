import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ROAD_NODES, ROAD_EDGES, BUILDINGS, CITY_ZONES } from '../src/data/cityMap';

const __dirname = dirname(fileURLToPath(import.meta.url));

const map = {
  nodes: ROAD_NODES,
  edges: ROAD_EDGES,
  buildings: BUILDINGS,
  zones: CITY_ZONES,
};

const json = JSON.stringify(map, null, 2);

const sharedPath = resolve(__dirname, '../../shared/city-map.json');
mkdirSync(dirname(sharedPath), { recursive: true });
writeFileSync(sharedPath, json);

const backendPath = resolve(__dirname, '../../backend/src/main/resources/city-map.json');
mkdirSync(dirname(backendPath), { recursive: true });
writeFileSync(backendPath, json);

console.log(`Wrote city map: ${ROAD_NODES.length} nodes, ${ROAD_EDGES.length} edges, ${BUILDINGS.length} buildings, ${CITY_ZONES.length} zones`);
console.log(`  -> ${sharedPath}`);
console.log(`  -> ${backendPath}`);
