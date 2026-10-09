import { describe, it, expect } from 'vitest';
import { handleHealthCheck } from '../../api/health';

describe('SIFT Skeleton Smoke Test', () => {
  it('passes trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('health endpoint returns ok status', async () => {
    const res = handleHealthCheck();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sift-proxy');
  });
});
