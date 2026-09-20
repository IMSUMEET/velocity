import Fastify from "fastify";
import cors from "@fastify/cors";
import { WebSocketServer, type WebSocket } from "ws";
import {
  cityMapData, exportCsv, exportLatex, runComparison, verdict,
  STRATEGIES, STRATEGY_META, type DispatchStrategy, type VehicleType,
} from "@velocity/engine";
import { LiveSim } from "./liveSim.js";

const PORT = Number(process.env.PORT ?? 8080);
const sim = new LiveSim();

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

const isStrategy = (s: unknown): s is DispatchStrategy =>
  typeof s === "string" && (STRATEGIES as readonly string[]).includes(s);

// -- meta -----------------------------------------------------------------
app.get("/api/health", async () => ({ status: "ok", service: "velocity" }));
app.get("/api/map", async () => cityMapData);
app.get("/api/snapshot", async () => sim.snapshot());
app.get("/api/state", async () => {
  const s = sim.snapshot();
  return { tick: s.tick, running: s.running, speed: s.speed, strategy: s.strategy, metrics: s.metrics };
});

// -- simulation controls --------------------------------------------------
app.post("/api/simulation/pause", async () => { sim.pause(); return { running: sim.running }; });
app.post("/api/simulation/resume", async () => { sim.resume(); return { running: sim.running }; });
app.post("/api/simulation/reset", async () => { sim.reset(); return { ok: true }; });
app.put<{ Body: { speed: number } }>("/api/simulation/speed", async (req) => {
  sim.setSpeed(Number(req.body?.speed) || 1);
  return { speed: sim.speed };
});

// -- dispatch -------------------------------------------------------------
app.get("/api/dispatch/strategies", async () =>
  STRATEGIES.map((id) => ({ id, ...STRATEGY_META[id] }))
);
app.get("/api/dispatch/attempts", async () => sim.engine.recentDispatchList());
app.put<{ Body: { strategy: string } }>("/api/dispatch/strategy", async (req, reply) => {
  const s = req.body?.strategy;
  if (!isStrategy(s)) return reply.code(400).send({ error: "unknown strategy" });
  sim.setStrategy(s);
  return { strategy: s };
});

// -- data -----------------------------------------------------------------
app.get("/api/drivers", async () => sim.engine.driverList());
app.get("/api/orders", async () => sim.engine.orderList());
app.get("/api/incidents", async () => sim.engine.incidentList());
app.get<{ Params: { orderId: string } }>("/api/traces/:orderId", async (req, reply) => {
  const t = sim.engine.traceFor(req.params.orderId);
  return t ?? reply.code(404).send({ error: "no trace" });
});

// -- operator actions -----------------------------------------------------
app.post<{ Body: { type?: VehicleType } }>("/api/drivers/deploy", async (req) =>
  sim.engine.deployDriver(req.body?.type === "CAR" ? "CAR" : "BIKE")
);
app.post<{ Params: { id: string } }>("/api/orders/:id/cancel", async (req) => ({ ok: sim.engine.cancelOrder(req.params.id) }));
app.post<{ Params: { id: string } }>("/api/orders/:id/priority", async (req) => ({ ok: sim.engine.boostPriority(req.params.id) }));
app.post<{ Params: { id: string } }>("/api/incidents/:id/mitigate", async (req) => ({ ok: sim.engine.mitigateIncident(req.params.id) }));
app.post<{ Params: { id: string } }>("/api/incidents/:id/resolve", async (req) => ({ ok: sim.engine.resolveIncident(req.params.id) }));
app.post("/api/admin/rush-delayed", async () => ({ rushed: sim.engine.rushDelayed() }));

// -- experiments (the Strategy Lab) ---------------------------------------
app.post<{ Body: { durationTicks?: number; seed?: number } }>("/api/experiments/compare", async (req) => {
  const ticks = Number(req.body?.durationTicks) || 240;
  const seed = Number(req.body?.seed) || 42;
  const results = runComparison(ticks, seed);
  return { results, verdict: verdict(results), ticks, seed };
});
app.get<{ Querystring: { ticks?: string; seed?: string } }>("/api/experiments/export/csv", async (req, reply) => {
  const results = runComparison(Number(req.query.ticks) || 240, Number(req.query.seed) || 42);
  reply.header("Content-Type", "text/csv").header("Content-Disposition", "attachment; filename=velocity-experiments.csv");
  return exportCsv(results);
});
app.get<{ Querystring: { ticks?: string; seed?: string } }>("/api/experiments/export/latex", async (req, reply) => {
  const results = runComparison(Number(req.query.ticks) || 240, Number(req.query.seed) || 42);
  reply.header("Content-Type", "text/plain");
  return exportLatex(results);
});

// -- boot + websocket -----------------------------------------------------
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`VeloCity server on http://localhost:${PORT}`);

const wss = new WebSocketServer({ server: app.server, path: "/ws" });
wss.on("connection", (socket: WebSocket) => {
  const send = (snap: unknown) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: "snapshot", data: snap }));
  };
  const unsubscribe = sim.subscribe(send);
  socket.on("close", unsubscribe);
  socket.on("error", unsubscribe);
});
