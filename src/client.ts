import { ExitProbeError } from './errors';
import { BillingResource } from './resources/billing';
import { MonitorsResource } from './resources/monitors';
import { ProjectsResource } from './resources/projects';
import { VpsResource } from './resources/vps';

export interface ExitProbeOptions {
  /** Your account API token (Settings → API Tokens in your dashboard). */
  apiKey: string;
  /** Override the API base URL — defaults to the ExitProbe production API. */
  baseUrl?: string;
  /** Fetch timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number;
  /** Custom fetch implementation (for environments without a global fetch). */
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.exitprobe.com/api/v1';

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
  readonly vps: VpsResource;
  readonly billing: BillingResource;

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
    this.vps = new VpsResource(this);
    this.billing = new BillingResource(this);
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
