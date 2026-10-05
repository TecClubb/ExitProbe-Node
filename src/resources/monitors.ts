import type { ExitProbe } from '../client';
import type {
  ApiResponse,
  BulkUpdateInput,
  ChecksHistoryParams,
  ListMonitorsParams,
  Monitor,
  MonitorInput,
  MonitorList,
  MonitorsSummary,
  UptimeParams,
} from '../types';

interface CheckResult {
  id: number;
  status: string;
  [key: string]: unknown;
}

/** Statuses that mean a check has not finished yet. */
const IN_FLIGHT = new Set(['pending', 'running']);

export class MonitorsResource {
  constructor(private readonly client: ExitProbe) {}

  /**
   * GET /monitors — list monitors with fleet status counts (`data.summary`).
   *
   * Pass `per_page` (and optionally `page`) to paginate; the counts always
   * cover the whole filtered fleet. See `listAll` to walk every page.
   */
  list(params: ListMonitorsParams = {}): Promise<ApiResponse<MonitorList>> {
    return this.client.request('GET', '/monitors', { query: params });
  }

  /**
   * Fetch every monitor by walking the pages for you. Uses `lean` and
   * `defer_uptime` by default so a 200-server fleet stays fast.
   */
  async listAll(params: Omit<ListMonitorsParams, 'page'> = {}): Promise<Monitor[]> {
    const perPage = params.per_page ?? 100;
    const all: Monitor[] = [];
    for (let page = 1; ; page++) {
      const res = await this.list({ lean: true, defer_uptime: true, ...params, per_page: perPage, page });
      all.push(...res.data.monitors);
      if (!res.data.pagination?.has_more) return all;
    }
  }

  /**
   * GET /monitors/summary — how many monitors are up, down, degraded,
   * flapping, IP-mismatched or inactive. Cheap enough to poll.
   */
  summary(params: { project_id?: number } = {}): Promise<ApiResponse<MonitorsSummary>> {
    return this.client.request('GET', '/monitors/summary', { query: params });
  }

  /** POST /monitors — create a monitor. Enable at least one `{protocol}_enabled` and set its config/URI. */
  create(input: MonitorInput): Promise<ApiResponse<{ monitor: Monitor; protocols: string[] }>> {
    return this.client.request('POST', '/monitors', { body: input });
  }

  /** POST /projects/{projectId}/monitors — create a monitor inside a specific project. */
  createForProject(projectId: number, input: MonitorInput): Promise<ApiResponse<{ monitor: Monitor; protocols: string[] }>> {
    return this.client.request('POST', `/projects/${projectId}/monitors`, { body: input });
  }

  /** GET /monitors/{id} — the full monitor, including its configs and per-protocol state. */
  get(id: number): Promise<ApiResponse<{ monitor: Monitor; [key: string]: unknown }>> {
    return this.client.request('GET', `/monitors/${id}`);
  }

  /**
   * Everything the dashboard's monitor page shows, in one call: the monitor,
   * its live status, uptime for `range`, per-region uptime, analytics and the
   * latest checks. The requests run in parallel.
   */
  async details(id: number, { range = '24h', checks = 20 }: { range?: UptimeParams['range']; checks?: number } = {}) {
    const [monitor, status, uptime, regions, analytics, recentChecks] = await Promise.all([
      this.get(id),
      this.status(id),
      this.uptime(id, { range }),
      this.uptimeRegions(id, { range }),
      this.analytics(id, { range }),
      this.checks(id, { per_page: checks }),
    ]);

    return {
      monitor: monitor.data,
      status: status.data,
      uptime: uptime.data,
      regions: regions.data,
      analytics: analytics.data,
      checks: recentChecks.data,
    };
  }

  /** PUT /monitors/{id} — send only the fields you want to change. */
  update(id: number, input: Partial<MonitorInput>): Promise<ApiResponse<{ monitor: Monitor }>> {
    return this.client.request('PUT', `/monitors/${id}`, { body: input });
  }

  /** POST /monitors/bulk-update — change the interval and/or probe assignment of many monitors at once. */
  bulkUpdate(input: BulkUpdateInput): Promise<ApiResponse<unknown>> {
    return this.client.request('POST', '/monitors/bulk-update', { body: input });
  }

  /** DELETE /monitors/{id} — soft-deletes; see `restore`. */
  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/monitors/${id}`);
  }

  /** POST /monitors/{id}/restore */
  restore(id: number): Promise<ApiResponse<{ monitor: Monitor }>> {
    return this.client.request('POST', `/monitors/${id}/restore`);
  }

  /** POST /monitors/{id}/check-now — queue an on-demand check; poll it with `checkStatus` or use `checkNowAndWait`. */
  checkNow(id: number): Promise<ApiResponse<{ check_ids: number[]; [key: string]: unknown }>> {
    return this.client.request('POST', `/monitors/${id}/check-now`);
  }

  /** GET /monitors/{id}/check-status?ids=1,2,3 — poll checks dispatched by `checkNow`. */
  checkStatus(id: number, checkIds: number[]): Promise<ApiResponse<{ checks?: CheckResult[]; all_complete?: boolean; completed_count?: number; [key: string]: unknown }>> {
    return this.client.request('GET', `/monitors/${id}/check-status`, {
      query: { ids: checkIds.join(',') },
    });
  }

  /**
   * Run a check and resolve once every probe has answered (or `timeoutMs`
   * passes, default 90s — an IKEv2 handshake alone can take a minute).
   */
  async checkNowAndWait(id: number, { timeoutMs = 90_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}) {
    const dispatched = await this.checkNow(id);
    const ids = dispatched.data.check_ids ?? [];
    if (ids.length === 0) return { completed: true, checks: [] as CheckResult[] };

    const deadline = Date.now() + timeoutMs;
    let checks: CheckResult[] = [];
    while (Date.now() < deadline) {
      const res = await this.checkStatus(id, ids);
      checks = (res.data.checks ?? []) as CheckResult[];
      if (res.data.all_complete ?? (checks.length > 0 && checks.every((c) => !IN_FLIGHT.has(c.status)))) {
        return { completed: true, checks };
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return { completed: false, checks };
  }

  /** GET /monitors/{id}/checks — paginated raw check history. */
  checks(id: number, params: ChecksHistoryParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/checks`, { query: params });
  }

  /** DELETE /monitors/{id}/checks — clears stored check history for this monitor. */
  clearChecks(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/monitors/${id}/checks`);
  }

  /** GET /monitors/{id}/uptime — uptime %, latency and timeline bars for `range` (1h … 90d). */
  uptime(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/uptime`, { query: params });
  }

  /** GET /monitors/{id}/uptime/regions — per-probe-region uptime breakdown. */
  uptimeRegions(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/uptime/regions`, { query: params });
  }

  /** GET /monitors/{id}/analytics — the charting payload behind the monitor page's graphs. */
  analytics(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/analytics`, { query: params });
  }

  /** GET /monitors/{id}/status — lightweight health, 24h uptime and per-protocol state. */
  status(id: number): Promise<ApiResponse<{ status: string; [key: string]: unknown }>> {
    return this.client.request('GET', `/monitors/${id}/status`);
  }
}

