const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  simulation: {
    start: () => request('/api/simulation/start', { method: 'POST' }),
    pause: () => request('/api/simulation/pause', { method: 'POST' }),
    resume: () => request('/api/simulation/resume', { method: 'POST' }),
    reset: () => request('/api/simulation/reset', { method: 'POST' }),
    setSpeed: (multiplier: number) =>
      request('/api/simulation/speed', { method: 'POST', body: JSON.stringify({ multiplier }) }),
    getState: () => request<any>('/api/simulation/state'),
    getSnapshot: () => request<any>('/api/simulation/snapshot'),
  },
  orders: {
    list: () => request<any[]>('/api/orders'),
    get: (id: string) => request<any>(`/api/orders/${id}`),
    reassign: (id: string) => request('/api/orders/' + id + '/reassign', { method: 'POST' }),
    cancel: (id: string) => request('/api/orders/' + id + '/cancel', { method: 'POST' }),
    boostPriority: (id: string) => request('/api/orders/' + id + '/priority', { method: 'POST' }),
  },
  drivers: {
    list: () => request<any[]>('/api/drivers'),
    get: (id: string) => request<any>(`/api/drivers/${id}`),
    deploy: (vehicleType: string) =>
      request('/api/drivers/deploy', { method: 'POST', body: JSON.stringify({ vehicleType }) }),
    forceOffline: (id: string) => request('/api/drivers/' + id + '/force-offline', { method: 'POST' }),
    bringOnline: (id: string) => request('/api/drivers/' + id + '/bring-online', { method: 'POST' }),
    relocate: (id: string, zone: string) =>
      request('/api/drivers/' + id + '/relocate', { method: 'POST', body: JSON.stringify({ zone }) }),
  },
  dispatch: {
    attempts: () => request<any[]>('/api/dispatch/attempts'),
    attemptForOrder: (orderId: string) => request<any>(`/api/dispatch/attempts/${orderId}`),
    strategies: () => request<string[]>('/api/dispatch/strategies'),
    setStrategy: (strategy: string) =>
      request('/api/dispatch/strategy', { method: 'PUT', body: JSON.stringify({ strategy }) }),
  },
  events: {
    list: (limit = 100, category?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (category) params.set('category', category);
      return request<any[]>(`/api/events?${params}`);
    },
  },
  queues: {
    list: () => request<any[]>('/api/queues'),
  },
  incidents: {
    list: () => request<any[]>('/api/incidents'),
    mitigate: (id: string) => request('/api/incidents/' + id + '/mitigate', { method: 'POST' }),
    resolve: (id: string) => request('/api/incidents/' + id + '/resolve', { method: 'POST' }),
  },
  traces: {
    get: (orderId: string) => request<any>(`/api/traces/${orderId}`),
  },
  analytics: {
    metrics: () => request<any>('/api/analytics/metrics'),
  },
  admin: {
    rushDelayed: () => request('/api/admin/rush-delayed', { method: 'POST' }),
    recalculateRoutes: () => request('/api/admin/recalculate-routes', { method: 'POST' }),
  },
  map: {
    get: () => request<any>('/api/map'),
  },
  experiments: {
    run: (strategy: string, durationTicks = 200, seed = 42) =>
      request<any>('/api/experiments/run', {
        method: 'POST',
        body: JSON.stringify({ strategy, durationTicks, seed }),
      }),
    compare: (durationTicks = 200, seed = 42) =>
      request<any[]>('/api/experiments/compare', {
        method: 'POST',
        body: JSON.stringify({ durationTicks, seed }),
      }),
    exportCsvUrl: (ticks = 200, seed = 42) =>
      `${BASE}/api/experiments/export/csv?ticks=${ticks}&seed=${seed}`,
    exportLatexUrl: (ticks = 200, seed = 42) =>
      `${BASE}/api/experiments/export/latex?ticks=${ticks}&seed=${seed}`,
  },
};
