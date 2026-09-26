import { ExitProbeError } from './errors';
import type {
  ApiResponse,
  ChecksHistoryParams,
  ListMonitorsParams,
  Monitor,
  MonitorInput,
  Project,
  ProjectInput,
  UptimeParams,
} from './types';

export interface ExitProbeOptions {
  /** Your account API token, e.g. `ep_live_...` (Settings → API Tokens). */
  apiKey: string;
  /** Override the API base URL — defaults to the ExitProbe production API. */
  baseUrl?: string;
  /** Fetch timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Custom fetch implementation (for environments without a global fetch). */
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://app.exitprobe.com/api/v1';

/**
 * ExitProbe API client. One instance per API token.
 *
 * ```ts
 * const client = new ExitProbe({ apiKey: process.env.EXITPROBE_API_KEY! });
 * const { monitors } = await client.monitors.list({ status: 'down' });
 * ```
 */
export class ExitProbe {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  readonly monitors: MonitorsResource;
  readonly projects: ProjectsResource;

  constructor(options: ExitProbeOptions) {
    if (!options.apiKey) {
      throw new Error('ExitProbe: apiKey is required');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? fetch;

    this.monitors = new MonitorsResource(this);
    this.projects = new ProjectsResource(this);
  }

  /** Low-level request — used by the resource classes, exposed for endpoints not yet wrapped. */
  async request<T>(
    method: string,
    path: string,
    { query, body }: { query?: object; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ExitProbeError(`Request to ${path} timed out after ${this.timeoutMs}ms`, 0);
      }
      throw new ExitProbeError(`Network error calling ${path}: ${(err as Error).message}`, 0);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const json = text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      const hasMessage = json !== undefined && typeof json === 'object' && json !== null && 'message' in json;
      const message: string = hasMessage
        ? String((json as { message: unknown }).message)
        : `ExitProbe API request failed with status ${res.status}`;
      const errors = json && typeof json === 'object' ? (json as any).errors : undefined;
      throw new ExitProbeError(message, res.status, errors, json);
    }

    return json as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

class MonitorsResource {
  constructor(private readonly client: ExitProbe) {}

  /** GET /monitors — list monitors, optionally filtered/scoped to a project. */
  list(params: ListMonitorsParams = {}): Promise<ApiResponse<{ total: number; monitors: Monitor[]; [key: string]: unknown }>> {
    return this.client.request('GET', '/monitors', { query: params });
  }

  /** POST /monitors — create a monitor. Pass `project_id` inside `input` via `POST /projects/{id}/monitors` semantics is not needed; scope with the `project_id` query param on list instead, or create directly under a project with `createForProject`. */
  create(input: MonitorInput): Promise<ApiResponse<{ monitor: Monitor; protocols: string[] }>> {
    return this.client.request('POST', '/monitors', { body: input });
  }

  /** POST /projects/{projectId}/monitors — create a monitor inside a specific project. */
  createForProject(projectId: number, input: MonitorInput): Promise<ApiResponse<{ monitor: Monitor; protocols: string[] }>> {
    return this.client.request('POST', `/projects/${projectId}/monitors`, { body: input });
  }

  /** GET /monitors/{id} */
  get(id: number): Promise<ApiResponse<{ monitor: Monitor }>> {
    return this.client.request('GET', `/monitors/${id}`);
  }

  /** PUT /monitors/{id} */
  update(id: number, input: Partial<MonitorInput>): Promise<ApiResponse<{ monitor: Monitor }>> {
    return this.client.request('PUT', `/monitors/${id}`, { body: input });
  }

  /** DELETE /monitors/{id} — soft-deletes; see `restore`. */
  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/monitors/${id}`);
  }

  /** POST /monitors/{id}/restore */
  restore(id: number): Promise<ApiResponse<{ monitor: Monitor }>> {
    return this.client.request('POST', `/monitors/${id}/restore`);
  }

  /** POST /monitors/{id}/check-now — triggers an on-demand check across the monitor's probes. */
  checkNow(id: number): Promise<ApiResponse<{ check_ids: number[]; [key: string]: unknown }>> {
    return this.client.request('POST', `/monitors/${id}/check-now`);
  }

  /** GET /monitors/{id}/check-status?ids=1,2,3 — poll checks dispatched by `checkNow`. */
  checkStatus(id: number, checkIds: number[]): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/check-status`, {
      query: { ids: checkIds.join(',') },
    });
  }

  /** GET /monitors/{id}/checks — paginated raw check history. */
  checks(id: number, params: ChecksHistoryParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/checks`, { query: params });
  }

  /** DELETE /monitors/{id}/checks — clears stored check history for this monitor. */
  clearChecks(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/monitors/${id}/checks`);
  }

  /** GET /monitors/{id}/uptime */
  uptime(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/uptime`, { query: params });
  }

  /** GET /monitors/{id}/uptime/regions — per-probe-region uptime breakdown. */
  uptimeRegions(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/uptime/regions`, { query: params });
  }

  /** GET /monitors/{id}/analytics — full charting/analytics payload for the monitor detail page. */
  analytics(id: number, params: UptimeParams = {}): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', `/monitors/${id}/analytics`, { query: params });
  }

  /** GET /monitors/{id}/status — lightweight status probe, cheap to poll from third-party integrations. */
  status(id: number): Promise<ApiResponse<{ status: MonitorStatusOnly }>> {
    return this.client.request('GET', `/monitors/${id}/status`);
  }
}

interface MonitorStatusOnly {
  status: string;
  [key: string]: unknown;
}

class ProjectsResource {
  constructor(private readonly client: ExitProbe) {}

  /** GET /projects */
  list(): Promise<ApiResponse<{ projects: Project[] }>> {
    return this.client.request('GET', '/projects');
  }

  /** POST /projects */
  create(input: ProjectInput): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', '/projects', { body: input });
  }

  /** GET /projects/{id} */
  get(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('GET', `/projects/${id}`);
  }

  /** PUT /projects/{id} */
  update(id: number, input: Partial<ProjectInput>): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('PUT', `/projects/${id}`, { body: input });
  }

  /** DELETE /projects/{id} — soft-deletes; see `restore`. */
  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/projects/${id}`);
  }

  /** POST /projects/{id}/restore */
  restore(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', `/projects/${id}/restore`);
  }

  /** POST /projects/{id}/regenerate-key — rotates the project's `api_key`. */
  regenerateKey(id: number): Promise<ApiResponse<{ project: Project }>> {
    return this.client.request('POST', `/projects/${id}/regenerate-key`);
  }

  /** DELETE /projects/{id}/checks — clears stored check history for every monitor in the project. */
  clearChecks(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/projects/${id}/checks`);
  }

  /** GET /projects/{id}/monitors — monitors scoped to this project. */
  monitors(id: number, params: ListMonitorsParams = {}): Promise<ApiResponse<{ total: number; monitors: Monitor[]; [key: string]: unknown }>> {
    return this.client.request('GET', `/projects/${id}/monitors`, { query: params });
  }
}
