export type Protocol =
  | 'wireguard'
  | 'openvpn'
  | 'ikev2'
  | 'vless'
  | 'hysteria'
  | 'trojan'
  | 'shadowsocks'
  | 'vmess';

export type MonitorStatus = 'up' | 'down' | 'degraded' | 'flapping' | 'pending';

export type UptimeRange = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '90d';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ListMonitorsParams {
  project_id?: number;
  protocol?: Protocol;
  /** Filter by fleet health: up, down, degraded, flapping, ip_mismatch or unknown. */
  status?: MonitorStatus | 'ip_mismatch' | 'unknown';
  search?: string;
  tag?: string;
  range?: UptimeRange;
  /** Send `page` and/or `per_page` (max 100) to paginate. Omit both to get every monitor. */
  page?: number;
  per_page?: number;
  /** Skip the per-monitor uptime bars and fleet chart — much faster for big fleets. */
  defer_uptime?: boolean;
  /** Drop stored configs/credentials from each row. */
  lean?: boolean;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
  has_more: boolean;
}

/** How many monitors sit in each health state. Counts cover the whole filtered set, not one page. */
export interface MonitorsSummary {
  total: number;
  up: number;
  down: number;
  degraded: number;
  flapping: number;
  ip_mismatch: number;
  unknown: number;
  /** Monitors that are switched off (overlaps with the health buckets). */
  inactive: number;
}

export interface MonitorList {
  total: number;
  summary: MonitorsSummary;
  /** `null` unless `page`/`per_page` was sent. */
  pagination: Pagination | null;
  monitors: Monitor[];
  [key: string]: unknown;
}

export interface BulkUpdateInput {
  monitor_ids: number[];
  check_interval_seconds?: number;
  probe_mode?: 'all' | 'single' | 'custom';
  probe_ids?: number[];
}

/**
 * Fields accepted by POST /monitors and PUT /monitors/{id}. Every field is
 * optional except `name` — at least one `{protocol}_enabled` + its
 * config/URI must be set, which the API enforces server-side (422 if not).
 */
export interface MonitorInput {
  name: string;
  expected_exit_ip?: string;
  protocol?: Protocol;
  check_interval_seconds?: number;
  probe_id?: number;
  probe_ids?: number[];

  wireguard_enabled?: boolean;
  wireguard_config?: string;

  openvpn_enabled?: boolean;
  openvpn_config?: string;
  openvpn_auth_username?: string;
  openvpn_auth_password?: string;

  ikev2_enabled?: boolean;
  ikev2_target_host?: string;
  ikev2_remote_id?: string;
  ikev2_auth_username?: string;
  ikev2_auth_password?: string;

  vless_enabled?: boolean;
  vless_uri?: string;

  hysteria_enabled?: boolean;
  hysteria_uri?: string;

  trojan_enabled?: boolean;
  trojan_uri?: string;

  shadowsocks_enabled?: boolean;
  shadowsocks_uri?: string;

  vmess_enabled?: boolean;
  vmess_uri?: string;

  // Legacy single-protocol fields — only used when `protocol` is set directly.
  config_content?: string;
  uri?: string;
  target_host?: string;
  target_port?: number;
  remote_id?: string;
  auth_username?: string;
  auth_password?: string;
}

export interface Monitor {
  id: number;
  user_id: number;
  project_id: number;
  name: string;
  protocol: string;
  expected_exit_ip: string | null;
  check_interval_seconds: number;
  status: string;
  is_active: boolean;
  probe_id: number | null;
  probe_ids: number[];
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ChecksHistoryParams {
  page?: number;
  per_page?: number;
  protocol?: Protocol;
}

export interface UptimeParams {
  range?: UptimeRange;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  api_key: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ProjectInput {
  name: string;
}

// ---------------------------------------------------------------- VPS

export type VpsAgentStatus = 'online' | 'offline' | 'unregistered';
export type VpsRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface ListVpsParams {
  project_id?: number;
  /** Filter by agent status: online, offline or unregistered. */
  status?: VpsAgentStatus;
  /** Matches name, IP address or hostname. */
  search?: string;
  page?: number;
  per_page?: number;
}

export interface VpsSummary {
  total: number;
  online: number;
  offline: number;
  unregistered: number;
  inactive: number;
  average_health_score: number | null;
  /** Servers graded poor or critical. */
  critical: number;
  excellent: number;
}

export interface VpsServer {
  id: number;
  project_id: number | null;
  name: string;
  ip_address: string;
  status: string;
  agent_status: VpsAgentStatus;
  agent_version: string | null;
  agent_last_seen_at: string | null;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  health_score: number | null;
  health_grade: string | null;
  is_active: boolean;
  [key: string]: unknown;
}

export interface VpsList {
  vps_servers: VpsServer[];
  summary: VpsSummary;
  pagination: Pagination | null;
  usage: { count: number; max_custom_vps: number; can_add_custom_vps: boolean };
}

export interface VpsInput {
  name: string;
  ip_address: string;
  project_id?: number;
  location_country?: string;
  location_city?: string;
  country_code?: string;
}

export interface VpsUpdateInput {
  name?: string;
  is_active?: boolean;
  /** Mute outbound alerts; incidents are still recorded. */
  notifications_enabled?: boolean;
  /** 50–100 */
  cpu_threshold?: number;
  memory_threshold?: number;
  disk_threshold?: number;
  /** 5–1440 minutes a reading must stay over the threshold. */
  threshold_duration_minutes?: number;
}

export interface VpsHealthSnapshot {
  recorded_at: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  [key: string]: unknown;
}

export interface VpsIncident {
  id: number;
  type: string;
  status: string;
  reason: string | null;
  started_at: string;
  resolved_at: string | null;
}

export interface VpsDetail {
  vps_server: VpsServer;
  health_snapshots: VpsHealthSnapshot[];
  incidents: VpsIncident[];
}

export interface VpsHistoryParams {
  range?: VpsRange;
  /** Max snapshots, 1–2000. Defaults to 500. */
  limit?: number;
}

/** Returned when a VPS is registered or its token is rotated. The token is shown once. */
export interface VpsInstall {
  agent_token: string;
  /** One-time shell command to run on the server. */
  install_command: string;
}

// ------------------------------------------------------------ Billing

export interface LimitMeter {
  used: number;
  limit: number;
  [key: string]: unknown;
}

export interface Usage {
  plan: {
    id: number;
    name: string;
    slug: string;
    price: number;
    billing_interval: string;
    monitor_limit: number;
    project_limit: number;
    max_custom_vps: number;
    max_custom_probes: number;
    manual_checks_per_month: number;
    min_check_interval_seconds: number;
    data_retention_days: number;
    [key: string]: unknown;
  };
  monitors: LimitMeter;
  projects: LimitMeter;
  custom_probes: LimitMeter;
  custom_vps: LimitMeter;
  integrations: LimitMeter;
  manual_checks: Record<string, unknown>;
  billing: {
    credit_balance: number;
    plan_period_started_at: string | null;
    /** When the paid period renews/lapses. `null` on a free plan. */
    plan_period_ends_at: string | null;
    is_on_active_premium_period: boolean;
    /** Whole days to renewal; negative once lapsed. `null` on a free plan. */
    days_until_renewal: number | null;
  };
  capabilities: Record<string, unknown>;
}
