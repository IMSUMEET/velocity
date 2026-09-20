# VeloCity: A Simulation Platform for Studying Online Order Batching in Last-Mile Delivery Logistics

**Sumeet Suryawanshi**  
*Department of Computer Science*  
*[Institution Name], [City, State]*  
*[email@institution.edu]*

---

## Abstract

Last-mile delivery represents approximately 53% of total logistics cost and poses a fundamental combinatorial optimization challenge at scale. This paper presents **VeloCity**, a full-stack real-time simulation platform built to study the Dynamic Batching Vehicle Dispatch Problem (DBVDP) — a variant of the Online Vehicle Routing Problem with Time Windows (OVRPTW). The platform implements and compares five dispatch strategies across a synthetic 63-node, 6-zone urban road network: three greedy baselines (Fastest ETA, Lowest Cost, Balanced) and two online batching approaches (Batch Nearby using nearest-neighbor clustering; Batch Optimal using a greedy TSP insertion heuristic). Controlled experiments driven by a single seeded pseudo-random generator — so every strategy sees a bit-for-bit identical demand stream — show that in a dense-demand regime the batch strategies reduce total fleet distance by **~11%** relative to the Balanced greedy baseline while *completing more orders* (80 vs 75), at the cost of a modest increase in tail latency (**P95 +6.5 s**), yielding a controllable efficiency–latency trade-off. All latency metrics are measured in virtual simulation time (ticks), making them reproducible and independent of wall-clock speed. The platform provides a reproducible experimental framework with CSV and LaTeX export for academic use.

**Keywords:** last-mile delivery, vehicle routing, online batching, dispatch optimization, simulation

---

## I. Introduction

The explosive growth of on-demand delivery platforms — DoorDash, Uber Eats, Amazon Prime Now, and Google Shopping — has transformed last-mile logistics into a real-time combinatorial optimization problem at planetary scale. Each second, these platforms must decide: which driver should pick up which order, in what sequence, and should multiple nearby orders be combined into a single trip?

The dominant industry approach is **greedy dispatch**: assign each incoming order immediately to the nearest available driver. This minimizes per-order wait time but wastes fleet capacity. When three orders arrive within 60 seconds from restaurants on the same block, a greedy system dispatches three separate drivers. A batching system holds those orders briefly, groups them, and dispatches one driver for all three — reducing total fleet distance by up to 67% for that scenario.

The challenge is that batching introduces a hold window: customers must wait slightly longer while the system accumulates enough orders to justify a batch. This paper studies that trade-off empirically using VeloCity, a purpose-built simulation testbed.

### Contributions

1. We formalize the Dynamic Batching Vehicle Dispatch Problem (DBVDP) as a distinct variant of OVRPTW with an explicit hold-window parameter.
2. We implement five dispatch strategies (3 greedy, 2 batch) within a full-stack real-time simulation with authoritative server-side state and live observability.
3. We provide a reproducible experiment framework that runs all strategies on identical order arrival sequences and exports publication-ready tables.
4. We characterize the efficiency–latency trade-off empirically across 200-tick simulation runs on a 63-node synthetic city.

---

## II. Related Work

### A. Online Vehicle Routing

Jaillet and Wagner [3] survey online vehicle routing problems (OVRP), where requests arrive over time and decisions must be made without full knowledge of future arrivals. The key distinction from offline VRP is the irrevocability of dispatch decisions and the streaming nature of demand.

Ulmer et al. [2] study offline-online approximate dynamic programming for dynamic vehicle routing with stochastic requests, showing that combining a pre-computed value function with online re-optimization significantly outperforms both purely greedy and purely offline approaches.

### B. Pickup and Delivery

Berbeglia et al. [4] survey dynamic pickup and delivery problems, identifying three key problem classes: dial-a-ride, pickup-and-delivery, and same-day delivery. The DBVDP introduced here most closely resembles the same-day delivery variant with the additional complication of a hold buffer.

### C. Industry Approaches

DoorDash Engineering [5] describes their dispatch system as a combination of greedy assignment with post-hoc re-optimization: orders are initially assigned greedily but can be re-queued if a higher-quality match becomes available within a short window. Amazon [6] uses zone-based demand prediction to pre-position drivers before order arrival, reducing response time at the cost of idle driver miles.

Google OR-Tools [7] provides a general-purpose vehicle routing solver used in several industry deployments, but its batch optimization is inherently offline — unsuitable for the streaming, latency-sensitive context of on-demand delivery.

### D. City Logistics

Savelsbergh and van Woensel [8] identify the core challenge of city logistics: high demand density combined with strict time windows means that classical VRP heuristics that work well offline often fail to generalize to the online, real-time setting. They note that the gap between theoretical optimum and practical performance grows rapidly with demand density — exactly the regime on-demand delivery platforms operate in.

---

## III. System Architecture

VeloCity follows an **authoritative server simulation** pattern: all simulation state resides on the Java backend; the React frontend is a pure view layer that renders server-pushed snapshots. This mirrors how production dispatch systems work — a central state machine with read-only consumers.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js 14)                     │
│  Lab · Operations · Fleet & Orders · Method                      │
│  Zustand store ← applySnapshot() ← WebSocket                    │
│  api.ts (fetch) ──────────────────────────────────────────────► │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST /api/*
                               │ WS /ws → snapshot per tick
┌──────────────────────────────▼──────────────────────────────────┐
│                  NODE / TypeScript (Fastify)                    │
│                                                                  │
│  LiveSim (tick loop, 500ms)                                     │
│    └─ SimulationEngine (single seeded PRNG)                     │
│         ├─ DispatchEngine (greedy + batch strategies)           │
│         ├─ Pathfinding (Dijkstra with incident weights)         │
│         └─ CityMap (63 nodes, 93 edges, 6 zones)               │
│                                                                  │
│  In-process event bus · queue metrics · order traces           │
│  ExperimentRunner (headless, seeded) ──► CSV / LaTeX / JSON     │
└─────────────────────────────────────────────────────────────────┘
```

The engine is a dependency-free, isomorphic TypeScript module (`@velocity/engine`) shared by the server (live simulation) and the headless benchmark runner, so the experiment code path is the exact same code path that runs live. Event streaming, queue metrics, and OpenTelemetry-style traces are modeled as first-class in-process concepts rather than external brokers, so the whole stack runs with a single command.

### A. City Map Graph

The road network G = (V, E) is a JSON artifact (`engine/src/data/city-map.json`) used by both the frontend (for rendering) and the engine (for pathfinding and simulation).

| Property | Value |
|----------|-------|
| Nodes \|V\| | 63 |
| Edges \|E\| | 93 (undirected) |
| Zones | 6 (Downtown, Market District, University Row, Harbor Point, Capitol Heights, Stadium District) |
| Buildings | 26 (10 restaurants, 8 residential, 3 offices, 3 shops, 2 parks) |
| Coordinate space | SVG pixels, ~150–970 × ~98–730 |

Edge cost formula:

```
cost(e) = distance(e) × (1 + congestion(e)) / max(speedLimit(e), 1)
```

During incidents, a runtime multiplier inflates edge costs (traffic jam: 3×, accident: 6×), forcing Dijkstra to find alternate routes.

### B. Tick Loop

```
every 500ms:
  SimulationEngine.tick(speedMultiplier)
    ├─ decayIncidents()
    ├─ updateCookTimers()
    ├─ for each driver: moveDriver()
    ├─ maybeGenerateOrders()
    ├─ runDispatch()       ← strategy-dependent
    ├─ updateMoodsAndDelays()
    └─ maybeSpawnIncident()
  broadcastSnapshot() → /topic/snapshot
```

The speed multiplier (0.25×–10×) allows time compression for experiments.

### C. Observability

Every lifecycle transition (ORDER_CREATED, DISPATCH_MATCHED, PICKED_UP, DELIVERED, INCIDENT_OPENED, etc.) is recorded on an in-process event bus and streamed to the browser inside each snapshot. Each order carries an OpenTelemetry-style trace with span waterfalls, and queue depths/throughput are derived per tick — the observability concepts of a production dispatch stack, without the external broker footprint.

---

## IV. Problem Formulation

### A. Notation

| Symbol | Meaning |
|--------|---------|
| G = (V, E) | Directed road graph, weighted by effective travel cost |
| F | Fleet: set of driver-vehicle pairs |
| O_t | Set of orders arriving at time t |
| τ | Hold window (ticks) |
| r_o | Restaurant node for order o |
| c_o | Customer node for order o |
| d(u, v) | Shortest-path distance from node u to v (Dijkstra) |
| T_max | Maximum allowed delivery time (SLA) |
| B | Batch: a subset of O_t assigned to one driver f ∈ F |
| π(B) | Route: ordered sequence of pickup and delivery nodes |

### B. Greedy Dispatch

At each tick, pending orders are dispatched immediately in priority-descending order:

```
for each order o in O_pending (sorted by priority desc, age asc):
  f* = argmin_{f ∈ F_idle} score(f, o)
  assign(f*, o)
  F_idle ← F_idle \ {f*}
```

The scoring function for strategy BALANCED:

```
score(f, o) = 0.35 × d(pos_f, r_o)
            + 0.25 × eta(f, o)
            − 0.20 × age(o)   [minutes since creation]
            − 0.5  × exp(f)   [experience bonus]
            − 2.0  × bike(f)  [vehicle bonus]
```

### C. Batch Dispatch

Orders enter a hold queue H when strategy is BATCH_*. After τ ticks, the solver is invoked:

```
H ← orders in FINDING_DRIVER state
clusters ← cluster(H, strategy, radius_threshold)
for each cluster C ∈ clusters:
  f* ← driver nearest to centroid(C)
  π ← solveRoute(f*, C, strategy)
  assignBatch(f*, C, π)
```

The **multi-stop route** for a batch of k orders is:

```
π = [pos_f → r_{o1} → r_{o2} → ... → r_{ok} → c_{o1} → c_{o2} → ... → c_{ok}]
```

Pickup order is determined by the clustering heuristic; drop order follows pickup order (nearest-to-depot first).

### D. Objective Function

Minimize total fleet distance subject to SLA constraints:

```
minimize:  Σ_{f ∈ F} d(route_f)
subject to: t_delivery(o) ≤ T_max    ∀ o ∈ O
            |B_f| ≤ k_max             ∀ f ∈ F  (batch capacity)
```

The hold window τ introduces a latency–efficiency trade-off:
- Small τ → nearly greedy, low hold time, high fleet miles
- Large τ → more batching opportunities, more savings, but increased P50/P95

---

## V. Dispatch Strategies

### A. Greedy Strategies (Baseline)

**Fastest ETA:** Weights ETA at 80%, distance at 20%. Optimizes for customer-perceived wait time. Ignores fleet cost.

**Lowest Cost:** Weights distance at 70%, ETA at 30%. Minimizes fleet miles per delivery. May increase wait time.

**Balanced:** Multi-factor composite (distance, ETA, order age, driver experience, vehicle type). General-purpose baseline.

### B. Batch Strategies

**Batch Nearby (BATCH_NEARBY):** Nearest-neighbor spatial clustering.

```
Algorithm: Batch_Nearby(H, τ, r_max)
1. Wait until any order in H has held ≥ τ ticks
2. For each unassigned order o_i ∈ H:
   a. Start cluster C = {o_i}
   b. For each o_j ∈ H \ C where |C| < k_max:
      if distanceBetween(r_{o_i}, r_{o_j}) ≤ r_max:
         C ← C ∪ {o_j}
3. Sort pickups in C by nearest-neighbor from driver position
4. Build route: driver → sorted pickups → drops (same order)
5. Assign to nearest idle driver to cluster centroid
```

Parameters: τ = 5 ticks, r_max = 120 coordinate units, k_max = 3.

**Batch Optimal (BATCH_OPTIMAL):** Greedy cheapest-insertion TSP heuristic over the same proximity clusters.

```
Algorithm: Greedy_Insertion_TSP(driver_pos, orders)
1. tour ← [nearest order to driver_pos]
2. While remaining orders exist:
   a. For each candidate c, for each insertion position i:
      cost_increase = d(prev_i, c) + d(c, next_i) - d(prev_i, next_i)
   b. Insert candidate with minimum cost_increase
3. Return tour
```

Complexity: O(n²) per cluster where n = |C| ≤ k_max = 3. In practice runs in sub-millisecond time.

---

## VI. Experimental Setup

### A. Simulation Parameters

| Parameter | Value |
|-----------|-------|
| Initial drivers | 18 (12 bikes, 6 cars) |
| Order generation rate | 1 order / 2 ticks |
| Restaurant prep time | Uniform[5, 14] ticks |
| Driver fatigue threshold | 80 units (14 per delivery) |
| Break duration | 16 ticks |
| Incidents | Disabled during benchmarks (enabled in the live view) |
| Tick interval | 500 ms wall-clock; 0.5 s virtual sim-time |
| Hold window τ | 6 ticks |
| Max batch size k_max | 4 orders |
| Proximity radius r_max | 220 units |

### B. Experiment Protocol

All experiments run 240 ticks (≈120 simulated seconds) with a fixed random seed (default: 42). A single seeded PRNG drives order arrivals, restaurant/customer selection, prep times, and driver initialization, so every strategy experiences a bit-for-bit identical demand stream; incidents are disabled during benchmarks. This controlled setup allows attribution of metric differences to strategy choice alone.

**Metrics collected:**
- **Throughput:** Completed deliveries, pending orders, completion rate
- **Latency:** P50, P95, P99 delivery duration (seconds from order creation to delivery)
- **Efficiency:** Total fleet miles, miles per delivery
- **Batching:** Batched order count, average batch size, hold time, savings % vs greedy baseline
- **Quality:** Customer satisfaction (100 − delayed×5), revenue

### C. Export Formats

Results are available as:
- **CSV** (`GET /api/experiments/export/csv`) — suitable for R/Python analysis
- **LaTeX table** (`GET /api/experiments/export/latex`) — ready for paper inclusion

---

## VII. Results

The following table is produced by the experiment runner (seed = 42, 240 ticks, 120 orders generated). It is regenerated verbatim by `npm run experiment -w server` and exported to [`docs/benchmark.csv`](docs/benchmark.csv).

| Strategy | Completed | P50 (s) | P95 (s) | Fleet dist | dist/del | Batch% | Satisfaction |
|----------|:---------:|:-------:|:-------:|:----------:|:--------:|:------:|:------------:|
| Fastest ETA | 75 | 21.5 | 38.0 | 81,046 | 1,081 | 0% | 40 |
| Lowest Cost | 74 | 20.5 | 45.5 | 81,222 | 1,098 | 0% | 25 |
| Balanced | 75 | 21.5 | 38.0 | 81,046 | 1,081 | 0% | 40 |
| Batch Nearby | 80 | 24.0 | 47.5 | 72,648 | 908 | 91% | 55 |
| **Batch Optimal** | **80** | 24.0 | **44.5** | **72,433** | **905** | 92% | **60** |

*Distances are in map coordinate units. Latency is in virtual simulation seconds.*

### A. Findings

1. **Fleet distance:** Both batch strategies cut fleet distance to ~72.5k versus ~81.0k for the greedy baselines — a **10.6% reduction** for BATCH_OPTIMAL relative to BALANCED, and lower distance-per-delivery (905 vs 1,081, −16%). This lands squarely in the range reported for production batching systems.

2. **Throughput:** Contrary to the naïve expectation that holding orders reduces throughput, in the dense regime the batch strategies **completed more orders** (80 vs 75) — one driver serving a multi-stop route frees capacity that greedy dispatch spends on redundant round-trips.

3. **Latency:** Batching raises tail latency modestly — P95 **+6.5 s** for BATCH_OPTIMAL vs BALANCED (44.5 s vs 38.0 s) — the hold window's direct cost. BATCH_OPTIMAL's TSP insertion yields a **3 s better P95** than BATCH_NEARBY (44.5 vs 47.5) at comparable distance, its main advantage at these cluster sizes.

4. **Customer satisfaction:** Higher for batch (60 vs 40), because fewer orders breach the SLA when the fleet is used efficiently under load.

5. **The trade-off is regime-dependent.** In *sparse* demand (few simultaneous nearby orders) the hold window buys nothing and batching underperforms greedy — reproducible by lowering the arrival rate in the Lab. Batching wins precisely when demand density makes spatial clustering possible.

---

## VIII. Discussion

### A. Trade-off Characterization

The core insight is that greedy dispatch optimizes the **local** cost (minimize this order's wait time) while batch dispatch optimizes the **global** cost (minimize fleet miles across all current orders). These objectives conflict exactly in the regime where orders arrive faster than drivers can clear them — the common case during lunch/dinner peaks.

The hold window τ is the key hyperparameter:
- τ = 0 → degenerates to greedy dispatch
- τ → ∞ → degenerates to offline batch VRP (sub-optimal for online setting)
- Optimal τ depends on order arrival rate λ, fleet size |F|, and city density

### B. When Batching Helps

Batching provides the greatest benefit when:
1. **Spatial clustering:** Multiple simultaneous orders from nearby restaurants (same block or zone)
2. **High load:** More pending orders than idle drivers — hold window has no marginal cost
3. **Long-haul deliveries:** Driver time to pickup dominates, amortized over multiple orders

### C. When Batching Hurts

Batching degrades performance when:
1. **Low arrival rate:** Insufficient order density to form useful clusters within τ
2. **Time-sensitive SLAs:** Any added hold time breaches customer commitments
3. **Restaurant spread:** Orders arriving from geographically dispersed restaurants form no usable clusters

### D. Limitations

1. **Simplified road network:** The 63-node synthetic graph lacks real-world topology complexity (traffic signals, one-way streets, elevation)
2. **Homogeneous batch capacity:** All drivers limited to k_max = 3; real platforms differentiate by vehicle type
3. **Deterministic cook times:** Kitchen delays are random but uniform; correlated restaurant delays (e.g., all restaurants in a zone slow during a demand spike) are not modeled
4. **No driver preference modeling:** Real-world drivers accept/reject orders based on distance; acceptance rates affect effective dispatch quality

---

## IX. Conclusion and Future Work

This paper presented VeloCity, a full-stack simulation platform for studying online dispatch strategies in last-mile delivery logistics. We formalized the Dynamic Batching Vehicle Dispatch Problem and implemented five strategies (3 greedy, 2 batch) with a controlled experiment framework enabling reproducible comparison.

The platform demonstrates that spatial clustering and TSP-based route optimization can materially reduce fleet miles while maintaining acceptable customer latency, supporting the hypothesis that pure greedy dispatch leaves significant efficiency on the table.

### Future Work

1. **Adaptive hold window:** Tune τ dynamically based on real-time arrival rate estimation (e.g., exponential smoothing on order interarrival times)
2. **Reinforcement learning dispatch:** Replace the heuristic scorer with a trained policy that learns the efficiency–latency trade-off from experience
3. **Driver acceptance modeling:** Add probabilistic order acceptance based on distance and driver state
4. **Multi-restaurant batching:** Extend batch capacity to cover orders from geographically proximal (but different) restaurants rather than same-restaurant only
5. **Time-window constraints:** Add explicit customer time windows and study their interaction with batch hold times
6. **Real-world graph integration:** Replace the synthetic city with OpenStreetMap data for a real urban area

---

## References

[1] C. Archetti, M. G. Speranza, and M. W. P. Savelsbergh, "An Optimization-Based Framework for the Analysis of Online Vehicle Routing Problems," *Transportation Science*, vol. 50, no. 2, 2016. doi: 10.1287/trsc.2015.0646

[2] A. Ulmer, J. Goodson, D. Mattfeld, and M. Hennig, "Offline-Online Approximate Dynamic Programming for Dynamic Vehicle Routing with Stochastic Requests," *Transportation Science*, vol. 53, no. 1, 2019. doi: 10.1287/trsc.2018.0808

[3] P. Jaillet and M. R. Wagner, "Online Vehicle Routing Problems: A Survey," *Lecture Notes in Computer Science*, vol. 4340, 2006. doi: 10.1007/11971316_2

[4] G. Berbeglia, J.-F. Cordeau, and G. Laporte, "Dynamic Pickup and Delivery Problems," *European Journal of Operational Research*, vol. 202, no. 1, 2010. doi: 10.1016/j.ejor.2009.04.024

[5] DoorDash Engineering, "Solving the Last-Mile Problem at Scale," *DoorDash Engineering Blog*, 2022. Available: https://doordash.engineering

[6] Amazon Science, "Route Optimization for Last-Mile Delivery," *Amazon Science Blog*, 2023. Available: https://amazon.science

[7] Google Operations Research Team, "OR-Tools Vehicle Routing Reference," *Google Developers Documentation*, 2024. Available: https://developers.google.com/optimization/routing

[8] M. Savelsbergh and T. van Woensel, "City Logistics: Challenges and Opportunities," *Transportation Science*, vol. 50, no. 2, 2016. doi: 10.1287/trsc.2016.0675

[9] A. Archetti and M. G. Speranza, "The Split Delivery Vehicle Routing Problem: A Survey," in *The Vehicle Routing Problem: Latest Advances and New Challenges*, Springer, 2008. doi: 10.1007/978-0-387-77778-8_5

[10] N. Agatz, A. Fleischmann, and J. van Nunen, "E-fulfillment and Multi-Channel Distribution — A Research Agenda," *European Journal of Operational Research*, vol. 187, no. 2, 2008. doi: 10.1016/j.ejor.2007.04.024

---

*Full source code available at: [github.com/IMSUMEET/velocity](https://github.com/IMSUMEET/velocity)*  
*Live demo: `npm install && npm run dev` → http://localhost:3000*  
*Experiment API: `GET http://localhost:8080/api/experiments/export/csv?ticks=240&seed=42`*
