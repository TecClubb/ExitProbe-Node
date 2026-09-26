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
  status?: MonitorStatus;
  search?: string;
  range?: UptimeRange;
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
