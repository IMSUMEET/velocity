/** Tunable simulation parameters (ported from the original engine). */
export const SIM = {
  INITIAL_DRIVERS: 5,
  ORDER_GEN_BASE_TICKS: 7,
  CAR_STEP: 26.0,
  BIKE_STEP: 20.0,
  PREP_MIN_TICKS: 5,
  PREP_VAR_TICKS: 9,
  FATIGUE_PER_DELIVERY: 14,
  FATIGUE_BREAK_THRESHOLD: 80,
  BREAK_TICKS: 16,
  DELAYED_AGE_TICKS: 90, // 45s SLA at 0.5s/tick
  INCIDENT_CHECK_TICKS: 50,
  INCIDENT_CHANCE: 0.4,
  RECENT_DISPATCH_CAP: 60,
  TRACE_CAP: 150,
  BATCH_HOLD_TICKS: 6,
  BATCH_PROXIMITY_THRESHOLD: 220.0,
  MAX_BATCH_SIZE: 4,
  /** Virtual sim-time per tick. 200 ticks ≈ 100 simulated seconds. */
  SECONDS_PER_TICK: 0.5,
} as const;

export const round2 = (v: number) => Math.round(v * 100) / 100;
export const round1 = (v: number) => Math.round(v * 10) / 10;
