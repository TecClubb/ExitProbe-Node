import type { ExitProbe } from '../client';
import type { ApiResponse, Usage } from '../types';

/**
 * Read-only: plan, limits, usage and renewal. Changing or cancelling a plan
 * is deliberately not available to API tokens — do that in the dashboard.
 */
export class BillingResource {
  constructor(private readonly client: ExitProbe) {}

  /**
   * GET /usage — your plan, every limit with how much of it you have used,
   * wallet credit, and the renewal date (`billing.plan_period_ends_at`,
   * `billing.days_until_renewal`).
   */
  usage(): Promise<ApiResponse<Usage>> {
    return this.client.request('GET', '/usage');
  }

  /** GET /subscription/current — the plan with its full limits, plus the same usage meters. */
  current(): Promise<ApiResponse<{ plan: Usage['plan']; usage: Usage }>> {
    return this.client.request('GET', '/subscription/current');
  }

  /** GET /subscription/plans — the public plan catalog, including add-on prices. */
  plans(): Promise<ApiResponse<unknown>> {
    return this.client.request('GET', '/subscription/plans');
  }
}
