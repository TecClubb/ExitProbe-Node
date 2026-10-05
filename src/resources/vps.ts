import type { ExitProbe } from '../client';
import type {
  ApiResponse,
  ListVpsParams,
  VpsDetail,
  VpsHealthSnapshot,
  VpsHistoryParams,
  VpsIncident,
  VpsInput,
  VpsInstall,
  VpsList,
  VpsServer,
  VpsSummary,
  VpsUpdateInput,
} from '../types';

export class VpsResource {
  constructor(private readonly client: ExitProbe) {}

  /**
   * GET /user/vps — your VPS servers with fleet counts (`data.summary`).
   * Pass `per_page` (and optionally `page`) to paginate.
   */
  list(params: ListVpsParams = {}): Promise<ApiResponse<VpsList>> {
    return this.client.request('GET', '/user/vps', { query: params });
  }

  /** Fetch every VPS server by walking the pages for you. */
  async listAll(params: Omit<ListVpsParams, 'page'> = {}): Promise<VpsServer[]> {
    const perPage = params.per_page ?? 100;
    const all: VpsServer[] = [];
    for (let page = 1; ; page++) {
      const res = await this.list({ ...params, per_page: perPage, page });
      all.push(...res.data.vps_servers);
      if (!res.data.pagination?.has_more) return all;
    }
  }

  /** GET /user/vps/summary — online / offline / unregistered counts and the average health score. */
  summary(params: { project_id?: number } = {}): Promise<ApiResponse<VpsSummary>> {
    return this.client.request('GET', '/user/vps/summary', { query: params });
  }

  /**
   * POST /user/vps — register a server. The response carries the agent token
   * and the one-time `install_command` to run on the server; the token is
   * shown only now, so store it (or rotate it later with `regenerateToken`).
   */
  create(input: VpsInput): Promise<ApiResponse<VpsInstall & { vps_server: VpsServer }>> {
    return this.client.request('POST', '/user/vps', { body: input });
  }

  /** POST /user/vps/lookup-ip — resolve country/city for an IP before registering. */
  lookupIp(ip: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.client.request('POST', '/user/vps/lookup-ip', { body: { ip } });
  }

  /**
   * GET /user/vps/{id} — everything the dashboard's server page shows:
   * live CPU/RAM/disk/load/network, health score, availability, system
   * information, top processes, alert thresholds, snapshot history and incidents.
   */
  get(id: number, params: VpsHistoryParams = {}): Promise<ApiResponse<VpsDetail>> {
    return this.client.request('GET', `/user/vps/${id}`, { query: params });
  }

  /** The current state without the (large) snapshot history. */
  getSummary(id: number): Promise<ApiResponse<Pick<VpsDetail, 'vps_server'>>> {
    return this.client.request('GET', `/user/vps/${id}`, { query: { summary_only: 1 } });
  }

  /** Just the chart history and incidents for a window. */
  history(id: number, params: VpsHistoryParams = {}): Promise<ApiResponse<{ health_snapshots: VpsHealthSnapshot[]; incidents: VpsIncident[] }>> {
    return this.client.request('GET', `/user/vps/${id}`, { query: { ...params, history_only: 1 } });
  }

  /** PATCH /user/vps/{id} — rename, switch off, mute alerts, or change CPU / memory / disk alert thresholds. */
  update(id: number, input: VpsUpdateInput): Promise<ApiResponse<{ vps_server: VpsServer }>> {
    return this.client.request('PATCH', `/user/vps/${id}`, { body: input });
  }

  /** DELETE /user/vps/{id} — final; there is no restore. */
  delete(id: number): Promise<ApiResponse<unknown>> {
    return this.client.request('DELETE', `/user/vps/${id}`);
  }

  /** POST /user/vps/{id}/regenerate-token — rotate the agent token. The old token stops working immediately; run the returned `install_command` on the server. */
  regenerateToken(id: number): Promise<ApiResponse<VpsInstall & { vps_server_id: number }>> {
    return this.client.request('POST', `/user/vps/${id}/regenerate-token`);
  }
}
