import { describe, expect, it, jest } from '@jest/globals';
import { FakeStoreProductRepository } from '../src/repositories/FakeStoreProductRepository.js';
import { UpstreamError } from '../src/repositories/ProductRepository.js';

const upstreamProduct = {
  id: 1,
  title: ' Backpack ',
  price: 109.95,
  description: 'A bag',
  category: "men's clothing",
  image: 'https://fakestoreapi.com/img/1.png',
  rating: { rate: 3.9, count: 120 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function makeRepo(fetchFn: typeof fetch, now = () => 0) {
  return new FakeStoreProductRepository({
    baseUrl: 'https://fakestoreapi.com',
    timeoutMs: 1000,
    imageTimeoutMs: 1000,
    cacheTtlMs: 60_000,
    fetchFn,
    now,
  });
}

describe('FakeStoreProductRepository', () => {
  it('maps upstream products to internal records', async () => {
    const fetchFn = jest.fn<typeof fetch>(async () => json([upstreamProduct]));
    const repo = makeRepo(fetchFn);
    const [p] = await repo.listAll();
    expect(p).toEqual({
      id: 1,
      title: 'Backpack',
      description: 'A bag',
      price: 109.95,
      category: "men's clothing",
      rating: { rate: 3.9, count: 120 },
      sourceImageUrl: 'https://fakestoreapi.com/img/1.png',
    });
    expect(fetchFn).toHaveBeenCalledWith('https://fakestoreapi.com/products', expect.anything());
  });

  it('caches the list until the TTL expires', async () => {
    let t = 0;
    const fetchFn = jest.fn<typeof fetch>(async () => json([upstreamProduct]));
    const repo = makeRepo(fetchFn, () => t);
    await repo.listAll();
    await repo.getById(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    t = 60_001;
    await repo.listAll();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream call between concurrent cold requests', async () => {
    const fetchFn = jest.fn<typeof fetch>(async () => json([upstreamProduct]));
    const repo = makeRepo(fetchFn);
    await Promise.all([repo.listAll(), repo.listAll(), repo.getById(1)]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('throws UpstreamError on a 5xx', async () => {
    const repo = makeRepo((async () => json({}, 503)) as unknown as typeof fetch);
    await expect(repo.listAll()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError on network failure or timeout', async () => {
    const repo = makeRepo((async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    }) as unknown as typeof fetch);
    await expect(repo.listAll()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws UpstreamError on an unexpected payload shape', async () => {
    const repo = makeRepo((async () => json([{ id: 'x' }])) as unknown as typeof fetch);
    await expect(repo.listAll()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('does not cache failures', async () => {
    const fetchFn = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json([upstreamProduct]));
    const repo = makeRepo(fetchFn);
    await expect(repo.listAll()).rejects.toThrow();
    await expect(repo.listAll()).resolves.toHaveLength(1);
  });

  describe('getImage', () => {
    it('fetches the image bytes for a known product', async () => {
      const fetchFn = jest.fn<typeof fetch>(async (url) =>
        String(url).endsWith('/products')
          ? json([upstreamProduct])
          : new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
      );
      const repo = makeRepo(fetchFn);
      const image = await repo.getImage(1);
      expect(image?.contentType).toBe('image/png');
      expect([...(image?.data ?? [])]).toEqual([1, 2, 3]);
    });

    it('refuses to proxy an image from a different host', async () => {
      const evil = { ...upstreamProduct, image: 'https://evil.example/x.png' };
      const fetchFn = jest.fn<typeof fetch>(async () => json([evil]));
      const repo = makeRepo(fetchFn);
      await expect(repo.getImage(1)).rejects.toBeInstanceOf(UpstreamError);
      expect(fetchFn).toHaveBeenCalledTimes(1); // only the product list
    });

    it('rejects a non-image response', async () => {
      const fetchFn = jest.fn<typeof fetch>(async (url) =>
        String(url).endsWith('/products') ? json([upstreamProduct]) : new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      );
      const repo = makeRepo(fetchFn);
      await expect(repo.getImage(1)).rejects.toBeInstanceOf(UpstreamError);
    });

    // Regression: a timeout while streaming the body used to escape as a raw
    // TimeoutError and surface as a 500 instead of a 502.
    it('maps a failure while reading the image body to UpstreamError', async () => {
      const failingBody = new ReadableStream({
        pull(controller) {
          controller.error(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
        },
      });
      const fetchFn = jest.fn<typeof fetch>(async (url) =>
        String(url).endsWith('/products')
          ? json([upstreamProduct])
          : new Response(failingBody, { headers: { 'content-type': 'image/png' } }),
      );
      const repo = makeRepo(fetchFn);
      await expect(repo.getImage(1)).rejects.toBeInstanceOf(UpstreamError);
    });

    it('returns null for an unknown product', async () => {
      const repo = makeRepo((async () => json([upstreamProduct])) as unknown as typeof fetch);
      expect(await repo.getImage(42)).toBeNull();
    });
  });
});
