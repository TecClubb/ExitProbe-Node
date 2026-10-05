# exitprobe

Official Node.js / TypeScript client for the [ExitProbe](https://exitprobe.com) API. Manage VPN monitors, VPS servers and projects, read uptime/health/analytics, and check your plan and renewal date directly from your own app — no HTTP boilerplate.

## Install

```bash
npm install exitprobe
```

Requires Node 18+ (uses the global `fetch`). Works in any modern JS runtime (Node, Bun, Deno, Cloudflare Workers, edge functions).

## Quick start

```ts
import { ExitProbe } from 'exitprobe';

const client = new ExitProbe({
  apiKey: process.env.EXITPROBE_API_KEY!, // Settings → API Tokens, in your dashboard
});

// Fleet status at a glance: how many are up / down / degraded / flapping / inactive
const { data: counts } = await client.monitors.summary();

// A page of monitors (the counts always cover the whole fleet) ...
const { data: page } = await client.monitors.list({ per_page: 25, page: 1 });
// ... or every monitor, pages walked for you
const down = await client.monitors.listAll({ status: 'down' });

// Everything on a monitor's page: status, uptime, regions, analytics, latest checks
const detail = await client.monitors.details(42, { range: '7d' });

// Add a monitor, run a check and wait for every probe to answer
const { data: created } = await client.monitors.create({
  name: 'EU Exit Node',
  expected_exit_ip: '203.0.113.45',
  wireguard_enabled: true,
  wireguard_config: '[Interface]\nPrivateKey=...\n[Peer]\nPublicKey=...\nEndpoint=vpn.example.com:51820',
});
const { checks } = await client.monitors.checkNowAndWait(created.monitor.id);

// VPS servers: register one and get the one-time install command + token
const { data: vps } = await client.vps.create({ name: 'prod-db-1', ip_address: '203.0.113.5' });
console.log(vps.install_command); // run this once on the server
const { data: health } = await client.vps.get(vps.vps_server.id, { range: '24h' });
await client.vps.regenerateToken(vps.vps_server.id); // rotate the token

// Plan, limits and renewal date
const { data: usage } = await client.billing.usage();
console.log(usage.billing.plan_period_ends_at, usage.billing.days_until_renewal);
```

## Error handling

Every non-2xx response throws `ExitProbeError`, which carries the HTTP status and, for a `422`, the field-level validation errors:

```ts
import { ExitProbe, ExitProbeError } from 'exitprobe';

try {
  await client.monitors.create({ name: '' });
} catch (err) {
  if (err instanceof ExitProbeError) {
    console.error(err.status, err.message, err.errors);
  }
}
```

## API surface

- **`client.monitors`** — `list` (paginated, with `data.summary` fleet counts), `listAll`, `summary`, `create`, `createForProject`, `get`, `details`, `update`, `bulkUpdate`, `delete`, `restore`, `checkNow`, `checkStatus`, `checkNowAndWait`, `checks`, `clearChecks`, `uptime`, `uptimeRegions`, `analytics`, `status`
- **`client.vps`** — `list` (paginated, with `data.summary`), `listAll`, `summary`, `create` (returns the agent token and install command), `get`, `getSummary`, `history`, `update` (name, mute, alert thresholds), `regenerateToken`, `delete`, `lookupIp`
- **`client.billing`** — `usage` (plan, every limit and how much is used, credit, renewal date), `current`, `plans`. Read-only: changing or cancelling a plan is dashboard-only.
- **`client.projects`** — `list`, `create`, `get`, `update`, `delete`, `restore`, `regenerateKey`, `clearChecks`, `monitors`

Full reference with an example for each method: <https://exitprobe.com/docs/sdks/node>.

### Scoped tokens

A token with no abilities has full access. To limit one, choose abilities when creating it: `monitors:read|write`, `projects:read|write`, `vps:read|write`, `billing:read` (read-only), `integrations:read|write`. A call outside the token's abilities throws `ExitProbeError` with `status === 403`.

## Configuration

```ts
new ExitProbe({
  apiKey: process.env.EXITPROBE_API_KEY!,
  baseUrl: 'https://api.exitprobe.com/api/v1', // override for self-hosted/staging
  timeoutMs: 30_000,
});
```

## Publishing

Not published yet. Once you're ready:

```bash
npm login
npm run build
npm publish
```

`exitprobe` is the name in `package.json` — if it's taken on npm, switch to a scoped name like `@exitprobe/node` before publishing. Bump `version` and `npm publish` again for future releases.

## License

MIT
