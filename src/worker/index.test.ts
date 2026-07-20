import { z } from 'zod';
import { env } from 'cloudflare:test';
import { app } from './index';

const healthCheckSchema = z.object({ status: z.literal('ok') });

describe('Health check API', () => {
  it('GET /api/health returns status ok', async () => {
    const res = await app.request('/api/health', {}, env);
    expect(res.status).toBe(200);
    expect(healthCheckSchema.parse(await res.json())).toEqual({ status: 'ok' });
  });
});
