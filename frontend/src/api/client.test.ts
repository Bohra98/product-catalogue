import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('only calls our own /api origin, never Fake Store', async () => {
    const fetchMock = vi.fn(async () => json({ products: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await api.getFeatured();
    await api.search('a & b');
    expect(fetchMock.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      '/api/products/featured',
      '/api/products?q=a+%26+b',
    ]);
  });

  it('turns an error body into an ApiError with field messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ error: { code: 'VALIDATION_ERROR', message: 'Request is invalid', fields: { email: 'Bad' } } }, 400),
      ),
    );
    const err = await api.submitEnquiry({ productId: 1, name: 'a', email: 'b', message: 'c' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', fields: { email: 'Bad' } });
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api.getCategories()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
