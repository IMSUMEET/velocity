# VeloCity — Engineering Design Document

> A real-time logistics simulation engine built to demonstrate production-grade dispatch systems, graph algorithms, observability, and chaos engineering — the same problems solved daily at Uber, DoorDash, Google Maps, Stripe, Meta, and Netflix.

---

## What This Project Demonstrates

| Company | Relevant Engineering | Where in VeloCity |
|---------|---------------------|-------------------|
| **Uber** | Real-time dispatch, surge pricing, ETA prediction, marketplace matching | Dispatch engine, zone heat maps, multi-factor scoring |
| **DoorDash** | Order batching, restaurant operations, last-mile routing, delivery SLAs | Batch scoring bonus, order queue management, P95 tracking |
| **Google** | Graph algorithms, optimization, system design at scale | Dijkstra with binary heap, multi-factor optimization, road network modeling |
| **Stripe** | Event-driven architecture, idempotent operations, observability, UI polish | Event log, delivery records, keyboard shortcuts, claymorphism UI |
| **Meta** | Real-time state management, feed algorithms, A/B testing mindset | Zustand 60fps loop, dispatch scoring comparison, live feed rendering |
| **Netflix** | Chaos engineering, resilience, P50/P95/P99 observability, circuit breakers | Driver disconnects, restaurant closures, percentile delivery metrics |

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         BROWSER (React SPA)                        │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Mission     │  │   Game UI    │  │      SVG Map Engine      │ │
│  │   System      │  │  (TopBar,    │  │  (Roads, Buildings,      │ │
│  │  (Select →    │  │   BottomDock,│  │   Vehicles, Routes,      │ │
│  │   Brief →     │  │   RightPanel)│  │   Zone Overlays)         │ │
│  │   Play →      │  │              │  │                          │ │
│  │   Results)    │  │              │  │                          │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
│         │                 │                        │               │
│  ┌──────▼─────────────────▼────────────────────────▼─────────────┐ │
│  │                    Zustand Store (60fps tick loop)             │ │
│  │                                                               │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  Dispatch    │  │  Pathfinding │  │   Metrics Engine     │ │ │
│  │  │  Engine      │  │  (Dijkstra)  │  │  (P50/P95/P99,      │ │ │
│  │  │  (Scoring +  │  │  Binary Heap │  │   throughput, SLAs)  │ │ │
│  │  │   Batching)  │  │  O(V+E)logV │  │                      │ │ │
│  │  └─────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  │                                                               │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  Chaos       │  │  Event       │  │   Mission            │ │ │
│  │  │  Engine      │  │  System      │  │   Evaluator          │ │ │
│  │  │  (Failures,  │  │  (Traffic,   │  │   (Objectives,       │ │ │
│  │  │   Recovery)  │  │   Rain, etc) │  │    Grading)          │ │ │
│  │  └─────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Backend (Spring Boot) ─── PostgreSQL + PostGIS ─── Redis ─── Kafka│
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow (per tick, 60fps)

```
requestAnimationFrame
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │  1. Decrement mission timer                     │
  │  2. Expire driver boosts + old events           │
  │  3. Decay traffic multiplier (linear falloff)   │
  │  4. Move drivers along road edges (interpolate) │
  │  5. Check arrivals → record delivery time       │
  │  6. Update customer moods (wait-time buckets)   │
  │  7. Spawn orders (mission-dependent rate)       │
  │  8. Run dispatch (priority queue → scoring)     │
  │  9. Mark delayed orders (>45s SLA breach)       │
  │ 10. Compute P50/P95/P99 + zone heats + metrics │
  │ 11. Check mission end conditions                │
  └─────────────────────────────────────────────────┘
       │
       ▼
  React re-render (SVG map + floating UI)
```

---

## Core Algorithms

### 1. Pathfinding — Dijkstra's Algorithm

**File:** `src/engine/pathfinding.ts`

**Implementation:** Binary min-heap priority queue for O((V + E) log V) performance.

```typescript
findPath(startNodeId, endNodeId) → PathResult | null

interface PathResult {
  nodeIds: string[];   // ordered path through road network
  totalCost: number;   // weighted cost (distance × congestion × speed)
  totalDistance: number; // geometric Euclidean distance
}
```

**Why Dijkstra over A*:** The road graph has ~63 nodes and ~93 edges. At this scale, Dijkstra's simplicity and guaranteed optimality win over A*'s heuristic overhead. A* would be the right call at 10,000+ nodes.

**Trade-off considered:** BFS would give shortest-hop paths but ignores edge weights (distance, congestion, speed limits). Dijkstra respects all three.

### 2. Dispatch Engine — Multi-Factor Scoring

**File:** `src/engine/dispatch.ts`

The dispatch engine solves the **bipartite matching problem**: given N pending orders and M idle drivers, find the optimal assignment that minimizes total delivery time.

**Scoring formula (lower = better):**

```
score = distanceScore + etaScore - orderAgeScore + vehicleBonus + experienceBonus + batchBonus

where:
  distanceScore   = pathCost × 0.35        // proximity to restaurant
  etaScore        = estimatedETA × 0.25    // predicted delivery time
  orderAgeScore   = (age / 10s) × 0.20    // older orders get priority (SLA)
  vehicleBonus    = -5 if bike in congestion // bikes navigate traffic better
  experienceBonus = -experience × 0.5       // veteran drivers preferred
  batchBonus      = -8 if same restaurant   // batching opportunity (DoorDash)
```

**Why greedy assignment over Hungarian algorithm:** Orders arrive continuously and drivers become available asynchronously. A global optimal assignment at time T becomes suboptimal at T+1 when new orders arrive. Greedy with priority ordering (urgent orders first) gives near-optimal results in O(N × M × PathCost) with real-time responsiveness.

**Batch detection:** When scoring, the engine checks if another pending order shares the same restaurant node. If so, it applies a -8 bonus to encourage the same driver to pick up both, reducing total trips.

### 3. Priority Queue — Binary Min-Heap

**File:** `src/engine/pathfinding.ts` (MinHeap class)

Custom implementation with O(log n) insert and extract-min operations:
- `push(node, priority)` — bubble up
- `pop()` — extract min, sink down
- Used in both Dijkstra pathfinding and order prioritization

### 4. Percentile Computation — Delivery SLA Tracking

**How it works:** Every completed delivery records `durationMs = deliveredAt - createdAt`. The percentile engine maintains a rolling window of the last 150 delivery records, sorts them, and computes P50/P95/P99.

```typescript
P50 = sorted[ceil(0.50 × n) - 1]  // median delivery time
P95 = sorted[ceil(0.95 × n) - 1]  // 95th percentile (SLA target)
P99 = sorted[ceil(0.99 × n) - 1]  // tail latency
```

**Why this matters:** At Uber/DoorDash, P95 delivery time is a key business metric. A P95 of 25s means 95% of deliveries complete within 25 seconds. The remaining 5% represent "tail latency" — often caused by traffic, driver disconnects, or restaurant closures.

---

## Chaos Engineering

Inspired by Netflix's Chaos Monkey, VeloCity includes deliberate failure injection:

| Failure Mode | What Happens | Recovery |
|-------------|-------------|----------|
| **Driver Disconnect** (key: D) | Random active driver goes OFFLINE, their current order returns to the queue | Auto-reconnects after 15s |
| **Restaurant Closure** (key: X) | Random restaurant stops generating orders, existing orders at that restaurant still get delivered | Reopens after 20s |
| **Traffic Jam** (key: T) | Cars slow to 0.5x in a random zone, bikes get a 1.2x advantage | Decays linearly over 30 ticks |
| **Rain** (key: R) | Global 1.5x slowdown for all vehicles | Decays over 40 ticks |
| **Demand Surge** (key: L) | 8-12 orders flood in simultaneously from random restaurants | Natural dispatch |

**Design principle:** The system should degrade gracefully under failures. When a driver disconnects, their in-flight order is immediately reassigned to the dispatch queue — not lost. When a restaurant closes, existing orders still complete but no new ones generate from that location.

---

## Game Design (Mission System)

### Game Loop

```
MENU → select mission → BRIEFING → start → PLAYING → timer expires → RESULTS
                                      ↑                                  │
                                      └──────── retry ──────────────────┘
```

### Missions

| Mission | Time | Objectives | Special Conditions |
|---------|------|------------|-------------------|
| Morning Shift | 2:00 | Deliver 10, keep ETA < 8m | None |
| Lunch Rush | 2:30 | Deliver 20, max 3 delays, util > 50% | Demand surge |
| Rainy Day | 2:30 | Deliver 18, on-time > 70% | Persistent rain |
| Stadium Night | 3:00 | Deliver 30, max 5 delays, on-time > 60% | Traffic + surge |
| Free Play | ∞ | None | Sandbox |

### Player Actions

| Action | Key | Effect |
|--------|-----|--------|
| Play/Pause | Space | Toggle simulation |
| Speed 1x–10x | 1-4 | Time acceleration |
| Hire Car | C | Add a car driver at random node |
| Hire Bike | B | Add a bike rider at random node |
| Boost Zone | Click | Move 2 idle drivers toward a zone |
| Boost Driver | Click driver → Boost | 1.8x speed for 20 seconds |
| Recall Driver | Click driver → Recall | Cancel delivery, return to idle |
| Rush Order | Click building → Rush | Move order to front of dispatch queue |
| Manual Assign | Click idle driver → order | Bypass automatic dispatch |

---

## Road Network — Graph Model

### Data Structure

```typescript
interface RoadNode {
  id: string;      // e.g., "dt-1", "mk-5"
  x: number;       // SVG coordinate
  y: number;
  name?: string;   // named intersections
  zone: ZoneName;  // which district
}

interface RoadEdge {
  id: string;
  from: string;    // node id
  to: string;
  distance: number; // Euclidean distance
  speedLimit: number;
  congestion: number;
  isMajor: boolean;
}
```

### City Topology

- **63 road nodes** (intersections and building anchors)
- **93 road edges** (bidirectional roads)
- **26 named buildings** across 6 zones
- **6 districts**: Downtown, Market District, University Row, Harbor Point, Capitol Heights, Stadium District

### Why a custom graph instead of real maps?

1. **Deterministic simulation** — Same graph = reproducible results
2. **Controllable complexity** — 63 nodes is enough to demonstrate algorithms without requiring a spatial index
3. **No API dependency** — No Mapbox/Google Maps bills or rate limits
4. **Game balance** — Zone sizes and distances are tuned for gameplay pacing

---

## Observability Stack

### Metrics Computed Per Tick

| Metric | Formula | Used For |
|--------|---------|----------|
| Driver Utilization | `busy / total_active × 100` | Capacity planning |
| P50 Delivery Time | `median(delivery_durations)` | SLA monitoring |
| P95 Delivery Time | `95th_percentile(delivery_durations)` | Tail latency detection |
| P99 Delivery Time | `99th_percentile(delivery_durations)` | Outlier detection |
| Orders/Minute | `delivered / (elapsed / 60)` | Throughput monitoring |
| Zone Heat | `orders_per_zone` → LOW/MEDIUM/HIGH/SURGE | Demand prediction |
| Velocity Score | `50 + completion_bonus + utilization_bonus - delay_penalty - anger_penalty` | Overall health |

### Delivery Record Pipeline

```
Order created → assigned → driver picks up → driver delivers
                                                    │
                                              record {
                                                orderId,
                                                durationMs: deliveredAt - createdAt,
                                                timestamp
                                              }
                                                    │
                                              rolling window (last 150)
                                                    │
                                              sort → P50/P95/P99
```

---

## State Management — Zustand

### Why Zustand over Redux

1. **No boilerplate** — Single `create()` call vs actions/reducers/slices
2. **60fps compatible** — Direct state mutations in tick loop, no action dispatch overhead
3. **Selective subscriptions** — Components subscribe to specific slices (`useStore(s => s.drivers)`)
4. **Bundle size** — ~1KB vs ~7KB for Redux Toolkit

### Store Shape

```typescript
{
  // Game phase
  gamePhase: 'MENU' | 'BRIEFING' | 'PLAYING' | 'RESULTS';
  currentMission: Mission | null;
  missionTimeRemaining: number;

  // Simulation state
  isRunning: boolean;
  speed: 1 | 2 | 5 | 10;
  elapsedTime: number;
  tickCount: number;

  // Entities
  drivers: Driver[];          // with route, progress, experience
  orders: Order[];            // with mood, priority, timing
  dispatchDecisions: DispatchDecision[];  // with scoreBreakdown

  // Observability
  metrics: Metrics;           // P50/P95/P99, throughput, utilization
  deliveryRecords: DeliveryRecord[];  // rolling window
  zoneHeats: ZoneHeat[];

  // Chaos state
  activeEvents: GameEvent[];
  driverBoosts: DriverBoost[];
  closedRestaurants: Set<string>;
}
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| UI Framework | React 18 + TypeScript | Type safety, component model |
| Build Tool | Vite 5 | Sub-second HMR, optimized builds |
| Styling | Tailwind CSS + custom CSS | Utility-first + claymorphism design system |
| State | Zustand | Minimal overhead for 60fps loop |
| Animation | Framer Motion | Physics-based UI transitions |
| Map | Custom SVG | Full control, no external dependency |
| Icons | Lucide React | Tree-shakeable, consistent |
| Backend | Java 21, Spring Boot 3.2 | REST + WebSocket + STOMP |
| Database | PostgreSQL 16 + PostGIS 3.4 | Geospatial queries |
| Cache | Redis 7 | State cache, pub/sub |
| Messaging | Apache Kafka (Confluent 7.5) | Event streaming |
| Container | Docker + Docker Compose | Reproducible environments |

---

## Scaling Discussion

### What would change at Uber/DoorDash scale (millions of drivers)?

| Current (simulation) | At scale |
|---------------------|----------|
| Single Zustand store | Sharded by geo-region, event-sourced |
| Dijkstra in-browser | H3 hexagonal spatial index + precomputed shortest paths |
| 63 nodes | OpenStreetMap with billions of edges, Contraction Hierarchies |
| 150-record percentile window | Apache Flink streaming percentiles over time windows |
| JavaScript `Date.now()` | Vector clocks for distributed ordering |
| `setTimeout` reconnect | Circuit breaker with exponential backoff + jitter |
| In-memory delivery records | Kafka → ClickHouse for analytical queries |
| Single dispatch loop | Partition by zone, async dispatch workers with Kafka consumers |

### Trade-offs Made

1. **Client-side simulation vs server-side**: Chose client-side for zero-infrastructure demo. In production, simulation runs server-side with WebSocket state pushes.

2. **Greedy dispatch vs optimal**: Greedy with priority ordering achieves ~95% of optimal assignment quality at O(NM) vs O(N³) for Hungarian algorithm. At Uber's scale, even O(NM) is too slow per-request — they use spatial indexing to prune candidates first.

3. **Flat percentile computation vs streaming**: Sorting 150 records is O(n log n) per tick. At scale, use t-digest or DDSketch for approximate streaming percentiles in O(1) per sample.

4. **Set-based restaurant closures vs circuit breakers**: In VeloCity, closed restaurants are tracked with a `Set<nodeId>`. In production, this would be a circuit breaker pattern with half-open state for gradual recovery.

---

## Engineering Concepts Demonstrated

| Concept | Where | Relevance |
|---------|-------|-----------|
| **Graph algorithms (Dijkstra)** | `pathfinding.ts` | Google, Uber, Maps |
| **Priority queues (binary heap)** | `pathfinding.ts` | Google, Amazon |
| **Dispatch optimization** | `dispatch.ts` | Uber, DoorDash, Lyft |
| **Multi-factor scoring** | `dispatch.ts` | DoorDash, Uber |
| **Order batching** | `dispatch.ts` | DoorDash, Instacart |
| **P50/P95/P99 observability** | `simulationStore.ts` | Netflix, Google SRE |
| **Chaos engineering** | Store chaos actions | Netflix |
| **Event-driven architecture** | Game events system | Stripe, Netflix |
| **Real-time state management** | Zustand 60fps loop | Meta, Uber |
| **Mission/objective evaluation** | Mission grading system | Game design |
| **Customer mood modeling** | Wait-time → mood buckets | DoorDash, Uber |
| **Zone demand heat maps** | Zone heat computation | Uber surge, DoorDash |
| **Keyboard shortcuts** | App-wide hotkeys | Stripe, Linear |
| **Road network graph modeling** | `cityMap.ts` | Google Maps, Uber |
| **ETA calculation** | Path cost + speed factors | Uber, Google Maps |
| **Graceful degradation** | Restaurant closure recovery | Netflix, Stripe |
| **Delivery SLA tracking** | 45s timeout → DELAYED | DoorDash, Uber |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for backend services)

### Quick Start (Frontend Only)

```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:3000**

### Full Stack

```bash
docker compose up --build
```

### Keyboard Shortcuts (during gameplay)

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| 1–4 | Speed 1x / 2x / 5x / 10x |
| C | Hire car |
| B | Hire bike |
| L | Trigger lunch rush |
| R | Trigger rain |
| T | Trigger traffic jam |
| D | Disconnect random driver |
| X | Close random restaurant |
| Esc | Deselect |

---

## Resume Bullets

**VeloCity** — Real-Time Logistics Simulation Engine

- Engineered a dispatch optimization engine using Dijkstra's algorithm with binary heap priority queues and multi-factor scoring (distance, ETA, driver experience, order batching) to match drivers with orders across a 63-node road network.

- Built a real-time simulation loop at 60fps managing driver movement, order lifecycle, customer mood tracking, and P50/P95/P99 delivery time observability with rolling-window percentile computation.

- Implemented chaos engineering patterns (driver disconnects with auto-recovery, restaurant closures, traffic degradation) and a mission system with timed objectives and letter-grade evaluation.
