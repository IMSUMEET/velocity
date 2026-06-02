# VeloCity

**Real-Time Delivery Marketplace Simulation & Control Plane**

VeloCity is a full-stack prototype that simulates a city-scale delivery marketplace. A Spring Boot backend runs the authoritative simulation engine, while a React admin UI provides real-time observability and operator controls across 9 specialized dashboard tabs.

## Quick Start

```bash
docker compose up --build
```

Open http://localhost:3000 to see the control plane. The simulation starts automatically.

## Architecture

```
Browser (React Admin UI)                    Spring Boot Backend
┌──────────────────────────┐   REST/WS    ┌────────────────────────────────┐
│  AdminShell (9 tabs)     │◄────────────►│  SimulationService (tick loop) │
│  ├─ Marketplace (map+KPI)│              │  ├─ SimulationEngine (state)   │
│  ├─ Orders               │              │  ├─ DispatchEngine (3 strat.)  │
│  ├─ Drivers              │  /topic/     │  ├─ Pathfinding (Dijkstra)     │
│  ├─ Restaurants          │  snapshot    │  ├─ CityMap (graph + weights)  │
│  ├─ Dispatch             │◄────────────│  ├─ EventService               │
│  ├─ Events & Queues      │              │  └─ QueueMetricsService        │
│  ├─ Incidents            │              └────────┬───────────────────────┘
│  ├─ Traces               │                       │
│  └─ Analytics            │              ┌────────┴───────────────────────┐
│                          │              │  Infrastructure                │
│  platformStore (Zustand) │              │  ├─ PostgreSQL (event audit)   │
│  api.ts (REST client)    │              │  ├─ Redis (metrics cache)      │
│  useWebSocket (STOMP)    │              │  └─ Kafka (event backbone)     │
└──────────────────────────┘              └────────────────────────────────┘
```

### How it works

1. The **backend simulation engine** holds all state in memory: drivers, orders, incidents, traces, and dispatch attempts. A `@Scheduled` tick loop (500ms default) advances driver movement along a graph-based road network using Dijkstra pathfinding.

2. Every tick, the engine generates orders, runs multi-strategy dispatch (BALANCED / FASTEST_ETA / LOWEST_COST), spawns incidents, and computes metrics. A full-state **snapshot** is broadcast over STOMP WebSocket to all connected browsers.

3. The **React frontend** does not run its own simulation. It subscribes to `/topic/snapshot` and renders the server state. Operator actions (deploy driver, reassign order, mitigate incident) call REST endpoints that mutate the engine synchronously.

4. Platform events are persisted to **PostgreSQL** (durable audit log), streamed to **Kafka** (event backbone), and cached in **Redis** (hot metrics).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, STOMP/SockJS |
| Backend | Java 21, Spring Boot 3.2, Spring WebSocket, Spring Data JPA |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Messaging | Apache Kafka |
| Containerization | Docker, Docker Compose |

## Admin Control Plane (9 Tabs)

| Tab | Description |
|-----|-------------|
| **Marketplace** | KPI grid, network health, live SVG map with driver/building selection, speed/fleet controls |
| **Orders** | Sortable/filterable order table, status badges, reassign/cancel/boost priority actions |
| **Drivers** | Fleet table with status, fatigue bars, rating, relocate/offline/online controls |
| **Restaurants** | Prep backlog per restaurant, active orders, delay incident indicators |
| **Dispatch** | Strategy selector, dispatch attempt list, candidate ranking waterfall with score breakdown |
| **Events & Queues** | Live event feed with severity colors, queue depth/worker/health metrics |
| **Incidents** | SEV-1/2/3 incident cards, mitigate/resolve buttons, zone/edge/driver info |
| **Traces** | Order picker with span waterfall visualization showing full lifecycle |
| **Analytics** | Time-series charts (throughput, P50/P95 latency, backlog) via Recharts |

## API Overview

| Group | Key Endpoints |
|-------|--------------|
| Simulation | `POST /api/simulation/start\|pause\|resume\|reset\|speed`, `GET /state\|snapshot` |
| Orders | `GET /api/orders`, `POST /{id}/reassign\|cancel\|priority` |
| Drivers | `GET /api/drivers`, `POST /deploy\|/{id}/force-offline\|bring-online\|relocate` |
| Dispatch | `GET /api/dispatch/attempts`, `PUT /strategy`, `GET /strategies` |
| Events | `GET /api/events?category=&limit=` |
| Queues | `GET /api/queues` |
| Incidents | `GET /api/incidents`, `POST /{id}/mitigate\|resolve` |
| Traces | `GET /api/traces/{orderId}` |
| Analytics | `GET /api/analytics/metrics` |
| Map | `GET /api/map` |
| Admin | `POST /api/admin/rush-delayed\|recalculate-routes` |

## WebSocket

Connect via STOMP to `/ws`. Primary topic:

| Topic | Payload | Frequency |
|-------|---------|-----------|
| `/topic/snapshot` | Full simulation state (drivers, orders, metrics, incidents, events, zones, queues) | Every tick (~500ms) |
| `/topic/simulation` | Simulation control state (running, paused, speed) | On change |
| `/topic/events` | Individual platform events | On emission |

## Local Development (without Docker)

**Backend** (requires Postgres, or will fail on startup):
```bash
cd backend
mvn spring-boot:run
```

**Frontend** (connects to backend at localhost:8080):
```bash
cd frontend
npm install
npm run dev
```

Keyboard shortcuts: `Space` = pause/resume, `1-4` = speed, `Escape` = deselect.

## Environment Variables

**Backend:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/velocity` | PostgreSQL |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Redis host |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka brokers |
| `VELOCITY_SIMULATION_TICK_INTERVAL_MS` | `500` | Tick rate |

**Frontend:**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend REST URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL |

## Kafka Topics

| Topic | Description |
|-------|-------------|
| `platform-events` | All lifecycle events (orders, drivers, incidents) |
| `dispatch-assignment-events` | Dispatch matching decisions |
| `delivery-status-events` | Order status transitions |
| `simulation-tick` | Tick-level simulation state snapshots |

## Project Structure

```
VeloCity/
├── frontend/
│   └── src/
│       ├── components/Admin/     # AdminShell, Sidebar, 9 tab components
│       ├── components/Map/       # CityMapSVG, Roads, Vehicles, Zones
│       ├── services/api.ts       # Typed REST client
│       ├── hooks/useWebSocket.ts # STOMP subscription
│       ├── store/platformStore.ts # Server-synced Zustand store
│       ├── data/cityMap.ts       # Road network graph data
│       └── types/index.ts        # Shared TypeScript types
├── backend/
│   └── src/main/java/com/velocity/
│       ├── engine/               # SimulationEngine, DispatchEngine
│       ├── map/                  # CityMap, Pathfinding, MapModels
│       ├── model/                # In-memory POJOs, enums, Snapshot
│       ├── entity/               # PlatformEvent (JPA)
│       ├── service/              # SimulationService, EventService, QueueMetrics
│       ├── controller/           # REST controllers (11 endpoints groups)
│       ├── config/               # WebSocket, Kafka, Redis, CORS, Scheduler
│       └── kafka/                # KafkaProducer/Consumer
├── shared/city-map.json          # Canonical city graph (generated)
├── docker-compose.yml            # Full stack orchestration
└── README.md
```

## License

MIT
