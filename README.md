# exitprobe

Official Node.js / TypeScript client for the [ExitProbe](https://exitprobe.com) API. Manage projects and monitors, trigger checks, and read uptime/analytics directly from your own app — no HTTP boilerplate.

## Install

```bash
npm install exitprobe
```

Requires Node 18+ (uses the global `fetch`). Works in any modern JS runtime (Node, Bun, Deno, Cloudflare Workers, edge functions).

## Quick start

```ts
import { ExitProbe } from 'exitprobe';

const client = new ExitProbe({
  apiKey: process.env.EXITPROBE_API_KEY!, // Settings → API Tokens, looks like ep_live_...
});

// List monitors that are currently down
const { data } = await client.monitors.list({ status: 'down' });
console.log(data.monitors);

// Create a project, then a monitor inside it
const { data: project } = await client.projects.create({ name: 'Production' });
const { data: created } = await client.monitors.createForProject(project.project.id, {
  name: 'EU Exit Node',
  expected_exit_ip: '203.0.113.45',
  wireguard_enabled: true,
  wireguard_config: '[Interface]\nPrivateKey=...',
});

// Trigger an on-demand check, then poll it
const { data: dispatched } = await client.monitors.checkNow(created.monitor.id);
const status = await client.monitors.checkStatus(created.monitor.id, dispatched.check_ids);

// Uptime history and full analytics
await client.monitors.uptime(created.monitor.id, { range: '7d' });
await client.monitors.analytics(created.monitor.id, { range: '30d' });
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

- **`client.projects`** — `list`, `create`, `get`, `update`, `delete`, `restore`, `regenerateKey`, `clearChecks`, `monitors`
- **`client.monitors`** — `list`, `create`, `createForProject`, `get`, `update`, `delete`, `restore`, `checkNow`, `checkStatus`, `checks`, `clearChecks`, `uptime`, `uptimeRegions`, `analytics`, `status`

Every method mirrors an endpoint documented at `/api-docs` on your ExitProbe dashboard — see there for full request/response shapes.

## Configuration

```ts
new ExitProbe({
  apiKey: 'ep_live_...',
  baseUrl: 'https://app.exitprobe.com/api/v1', // override for self-hosted/staging
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
