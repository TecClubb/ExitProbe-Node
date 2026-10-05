import { describe, expect, it, vi } from 'vitest';
import { ExitProbe } from './client';
import { ExitProbeError } from './errors';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('ExitProbe client', () => {
  it('sends the bearer token and decodes a successful response', async () => {
    const fetchMock = fakeFetch(200, { success: true, data: { total: 0, monitors: [] } });
    const client = new ExitProbe({ apiKey: 'ep_live_test', fetch: fetchMock as unknown as typeof fetch });

    const res = await client.monitors.list({ status: 'down' });

    expect(res.data.monitors).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.exitprobe.com/api/v1/monitors?status=down');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer ep_live_test' });
  });

  it('sends a JSON body on create', async () => {
    const fetchMock = fakeFetch(200, { success: true, message: 'ok', data: { monitor: { id: 1 }, protocols: ['wireguard'] } });
    const client = new ExitProbe({ apiKey: 'ep_live_test', fetch: fetchMock as unknown as typeof fetch });

    await client.monitors.create({ name: 'Node 1', wireguard_enabled: true, wireguard_config: 'x' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ name: 'Node 1' });
  });

  it('throws ExitProbeError with field errors on a 422', async () => {
    const fetchMock = fakeFetch(422, {
      success: false,
      message: 'At least one VPN protocol must be configured.',
      errors: { name: ['The name field is required.'] },
    });
    const client = new ExitProbe({ apiKey: 'ep_live_test', fetch: fetchMock as unknown as typeof fetch });

    await expect(client.monitors.create({ name: '' })).rejects.toMatchObject({
      status: 422,
      message: 'At least one VPN protocol must be configured.',
      errors: { name: ['The name field is required.'] },
    });
  });

  it('respects a custom baseUrl', async () => {
    const fetchMock = fakeFetch(200, { success: true, data: { projects: [] } });
    const client = new ExitProbe({
      apiKey: 'ep_live_test',
      baseUrl: 'https://staging.example.com/api/v1/',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.projects.list();

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://staging.example.com/api/v1/projects');
  });

  it('rejects with ExitProbeError when apiKey is missing', () => {
    expect(() => new ExitProbe({ apiKey: '' })).toThrow('apiKey is required');
  });

  it('wraps network failures in ExitProbeError', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const client = new ExitProbe({ apiKey: 'ep_live_test', fetch: fetchMock as unknown as typeof fetch });

    await expect(client.projects.list()).rejects.toBeInstanceOf(ExitProbeError);
  });
});
