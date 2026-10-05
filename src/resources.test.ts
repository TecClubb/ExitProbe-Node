import { describe, expect, it, vi } from 'vitest';
import { ExitProbe } from './client';

type Route = (url: URL, init: RequestInit) => unknown;

/** A fetch that answers from `routes`, keyed "METHOD /path" — and records every call. */
function client(routes: Record<string, Route | unknown>) {
  const calls: { method: string; url: URL; body?: any }[] = [];
  const fetchMock = vi.fn(async (input: any, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const path = url.pathname.replace('/api/v1', '');
    calls.push({ method, url, body: init.body ? JSON.parse(init.body as string) : undefined });
    const hit = routes[`${method} ${path}`];
    if (hit === undefined) return new Response(JSON.stringify({ message: `no route ${method} ${path}` }), { status: 404 });
    const data = typeof hit === 'function' ? (hit as Route)(url, init) : hit;
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });
  return { api: new ExitProbe({ apiKey: 'k', fetch: fetchMock as unknown as typeof fetch }), calls };
}

const pagination = (page: number, hasMore: boolean) => ({ page, per_page: 2, total: 5, last_page: 3, has_more: hasMore });

describe('monitors', () => {
  it('listAll walks every page and asks for the lightweight payload', async () => {
    const { api, calls } = client({
      'GET /monitors': (url: URL) => {
        const page = Number(url.searchParams.get('page'));
        return { monitors: [{ id: page * 10 }, { id: page * 10 + 1 }], pagination: pagination(page, page < 3) };
      },
    });

    const all = await api.monitors.listAll({ per_page: 2, status: 'down' });

    expect(all.map((m) => m.id)).toEqual([10, 11, 20, 21, 30, 31]);
    expect(calls).toHaveLength(3);
    const first = calls[0].url.searchParams;
    expect(first.get('lean')).toBe('true');
    expect(first.get('defer_uptime')).toBe('true');
    expect(first.get('status')).toBe('down');
  });

  it('summary hits the cheap endpoint', async () => {
    const { api, calls } = client({ 'GET /monitors/summary': { total: 3, up: 2, down: 1 } });
    const res = await api.monitors.summary({ project_id: 4 });
    expect(res.data.down).toBe(1);
    expect(calls[0].url.searchParams.get('project_id')).toBe('4');
  });

  it('details gathers the whole monitor page in parallel', async () => {
    const { api, calls } = client({
      'GET /monitors/7': { monitor: { id: 7 } },
      'GET /monitors/7/status': { status: 'up' },
      'GET /monitors/7/uptime': { uptime_percentage: 99.9 },
      'GET /monitors/7/uptime/regions': { regions: [] },
      'GET /monitors/7/analytics': { series: [] },
      'GET /monitors/7/checks': { data: [] },
    });

    const d = await api.monitors.details(7, { range: '7d' });

    expect(d.status).toEqual({ status: 'up' });
    expect(d.uptime).toEqual({ uptime_percentage: 99.9 });
    expect(calls).toHaveLength(6);
    expect(calls.find((c) => c.url.pathname.endsWith('/uptime'))!.url.searchParams.get('range')).toBe('7d');
  });

  it('checkNowAndWait polls until every probe has answered', async () => {
    let polls = 0;
    const { api } = client({
      'POST /monitors/7/check-now': { check_ids: [1, 2] },
      'GET /monitors/7/check-status': () => {
        polls++;
        return polls < 3
          ? { checks: [{ id: 1, status: 'running' }], all_complete: false }
          : { checks: [{ id: 1, status: 'up' }, { id: 2, status: 'down' }], all_complete: true };
      },
    });

    const r = await api.monitors.checkNowAndWait(7, { intervalMs: 1 });

    expect(r.completed).toBe(true);
    expect(r.checks).toHaveLength(2);
    expect(polls).toBe(3);
  });

  it('checkNowAndWait gives up at the timeout without throwing', async () => {
    const { api } = client({
      'POST /monitors/7/check-now': { check_ids: [1] },
      'GET /monitors/7/check-status': { checks: [{ id: 1, status: 'running' }], all_complete: false },
    });

    const r = await api.monitors.checkNowAndWait(7, { timeoutMs: 20, intervalMs: 5 });

    expect(r.completed).toBe(false);
  });

  it('bulkUpdate posts the ids and the change', async () => {
    const { api, calls } = client({ 'POST /monitors/bulk-update': { updated: 2 } });
    await api.monitors.bulkUpdate({ monitor_ids: [1, 2], check_interval_seconds: 300 });
    expect(calls[0].body).toEqual({ monitor_ids: [1, 2], check_interval_seconds: 300 });
  });
});

describe('vps', () => {
  it('create returns the one-time token and install command', async () => {
    const { api, calls } = client({
      'POST /user/vps': { vps_server: { id: 3 }, agent_token: 'vps_abc', install_command: 'curl … | sudo bash' },
    });

    const res = await api.vps.create({ name: 'db-1', ip_address: '203.0.113.5' });

    expect(res.data.agent_token).toBe('vps_abc');
    expect(res.data.install_command).toContain('curl');
    expect(calls[0].body).toEqual({ name: 'db-1', ip_address: '203.0.113.5' });
  });

  it('listAll walks every page', async () => {
    const { api } = client({
      'GET /user/vps': (url: URL) => {
        const page = Number(url.searchParams.get('page'));
        return { vps_servers: [{ id: page }], pagination: pagination(page, page < 2) };
      },
    });
    expect((await api.vps.listAll()).map((v) => v.id)).toEqual([1, 2]);
  });

  it('history asks for the history-only payload with a range', async () => {
    const { api, calls } = client({ 'GET /user/vps/9': { health_snapshots: [], incidents: [] } });
    await api.vps.history(9, { range: '7d', limit: 200 });
    const q = calls[0].url.searchParams;
    expect([q.get('history_only'), q.get('range'), q.get('limit')]).toEqual(['1', '7d', '200']);
  });

  it('update uses PATCH with thresholds; regenerateToken and delete hit their routes', async () => {
    const { api, calls } = client({
      'PATCH /user/vps/9': { vps_server: { id: 9 } },
      'POST /user/vps/9/regenerate-token': { agent_token: 'vps_new', install_command: 'x' },
      'DELETE /user/vps/9': null,
    });

    await api.vps.update(9, { cpu_threshold: 80, notifications_enabled: false });
    const rotated = await api.vps.regenerateToken(9);
    await api.vps.delete(9);

    expect(calls[0].body).toEqual({ cpu_threshold: 80, notifications_enabled: false });
    expect(rotated.data.agent_token).toBe('vps_new');
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST', 'DELETE']);
  });
});

describe('billing', () => {
  it('usage returns the plan, meters and renewal date', async () => {
    const { api } = client({
      'GET /usage': { plan: { name: 'Pro' }, billing: { plan_period_ends_at: '2026-11-01T00:00:00Z', days_until_renewal: 29 } },
    });
    const res = await api.billing.usage();
    expect(res.data.billing.days_until_renewal).toBe(29);
  });

  it('exposes no way to change or cancel a plan', () => {
    const { api } = client({});
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(api.billing)).sort()).toEqual(['constructor', 'current', 'plans', 'usage']);
  });
});
