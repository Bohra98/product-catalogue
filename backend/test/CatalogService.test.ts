import { describe, expect, it } from '@jest/globals';
import { categorySlug, type ProductRecord } from '../src/domain/product.js';
import { FixtureProductRepository } from '../src/repositories/FixtureProductRepository.js';
import { CatalogService, matchesQuery, tokenize } from '../src/services/CatalogService.js';
import { product } from './helpers.js';

const options = { featuredCount: 2, categoryFeaturedCount: 1 };

describe('categorySlug', () => {
  it.each([
    ["men's clothing", 'mens-clothing'],
    ["women's clothing", 'womens-clothing'],
    ['electronics', 'electronics'],
    ['  Home & Garden ', 'home-garden'],
  ])('%s -> %s', (name, slug) => {
    expect(categorySlug(name)).toBe(slug);
  });
});

describe('CatalogService', () => {
  const repo = new FixtureProductRepository([
    product({ id: 1, rating: { rate: 4.8, count: 10 }, category: 'a' }),
    product({ id: 2, rating: { rate: 4.8, count: 400 }, category: 'a' }),
    product({ id: 3, rating: { rate: 2.0, count: 900 }, category: "b's" }),
    product({ id: 4, rating: { rate: 4.9, count: 1 }, category: 'a' }),
  ]);
  const catalog = new CatalogService(repo, options);

  it('ranks featured by rating, then rating count', async () => {
    const featured = await catalog.getFeatured();
    expect(featured.map((p) => p.id)).toEqual([4, 2]);
  });

  it('splits a category into featured and others, both in rank order', async () => {
    const result = await catalog.getCategoryProducts('a');
    expect(result?.category).toEqual({ slug: 'a', name: 'a' });
    expect(result?.featured.map((p) => p.id)).toEqual([4]);
    expect(result?.others.map((p) => p.id)).toEqual([2, 1]);
  });

  it('returns null for an unknown category', async () => {
    expect(await catalog.getCategoryProducts('nope')).toBeNull();
  });

  it('lists unique categories with slugs', async () => {
    expect(await catalog.getCategories()).toEqual([
      { slug: 'a', name: 'a' },
      { slug: 'bs', name: "b's" },
    ]);
  });

  it('exposes a same-origin image URL, never the upstream one', async () => {
    const p = await catalog.getProduct(1);
    expect(p?.imageUrl).toBe('/api/images/1');
    expect(JSON.stringify(p)).not.toContain('fakestoreapi.com');
  });
});

describe('CatalogService.search', () => {
  const repo = new FixtureProductRepository([
    product({ id: 1, title: 'Blue Cotton Jacket', description: 'warm', category: 'clothing' }),
    product({ id: 2, title: 'Red Jacket', description: 'Waterproof cotton shell', category: 'clothing' }),
    product({ id: 3, title: 'SSD Drive', description: 'fast storage', category: 'electronics' }),
  ]);
  const catalog = new CatalogService(repo, options);
  const ids = async (q: string) => (await catalog.search(q)).map((p) => p.id).sort();

  it('is case-insensitive', async () => {
    expect(await ids('JACKET')).toEqual([1, 2]);
  });

  it('matches description and category, not only title', async () => {
    expect(await ids('waterproof')).toEqual([2]);
    expect(await ids('electronics')).toEqual([3]);
  });

  it('requires every word to match', async () => {
    expect(await ids('cotton jacket')).toEqual([1, 2]);
    expect(await ids('blue waterproof')).toEqual([]);
  });

  it('returns nothing for whitespace-only input', async () => {
    expect(await ids('   ')).toEqual([]);
  });
});

describe('search term matching', () => {
  const words = (q: string) => tokenize(q);
  const matches = (q: string, text: Partial<ProductRecord>) =>
    matchesQuery(product({ id: 1, title: '', description: '', category: '', ...text }), tokenize(q));

  describe('tokenize', () => {
    it.each([
      ['  Mens   Jacket ', ['mens', 'jacket']],
      ["men's", ['mens']],
      ['men’s', ['mens']],
      ['T-Shirt', ['t', 'shirt']],
      ['Fjällräven', ['fjallraven']],
      ['c++ (beta)', ['c', 'beta']],
      ['2TB SSD', ['2tb', 'ssd']],
      ['   ', []],
      ['!!! ---', []],
    ])('%j -> %j', (q, expected) => {
      expect(words(q)).toEqual(expected);
    });
  });

  describe('matches at the start of a word', () => {
    it.each([
      ['men', { title: "Men's Jacket" }],
      ['men', { title: 'Mens Casual Slim Fit' }],
      ['men', { category: "men's clothing" }],
      ['jacket', { title: 'Two jackets' }],
      ['shirt', { title: 'Slim Fit T-Shirts' }],
      ['back', { title: 'Foldsack Backpack' }],
      ['ssd', { title: 'Internal SSD - SATA' }],
      ['2tb', { title: 'WD 2TB Drive' }],
    ])('%j matches %j', (q, text) => {
      expect(matches(q, text)).toBe(true);
    });
  });

  describe('does not match inside a word', () => {
    it.each([
      ['men', { title: "Women's Jacket" }],
      ['men', { title: 'Womens T Shirt' }],
      ['men', { category: "women's clothing" }],
      ['men', { description: 'Highly recommended' }],
      ['men', { description: 'Good for the environment' }],
      ['ring', { title: 'Tunnel Plug Earrings' }],
      ['pack', { title: 'Foldsack Backpack' }],
      ['menjacket', { title: "Women's Jacket" }],
      ['shirtcasual', { title: 'T Shirt Slim Casual' }],
    ])('%j does not match %j', (q, text) => {
      expect(matches(q, text)).toBe(false);
    });
  });

  describe('treats spelling variants the same', () => {
    it.each([
      ['mens', { category: "men's clothing" }],
      ['womens', { category: "women's clothing" }],
      ["women's", { title: 'Womens T Shirt' }],
      ['men’s', { category: "men's clothing" }],
      ["men's", { title: 'Men’s Watch' }],
      ['t-shirt', { title: 'Womens T Shirt' }],
      ['t shirt', { title: 'Slim Fit T-Shirts' }],
      ['fjällräven', { title: 'Fjallraven Foldsack' }],
      ['fjallraven', { title: 'Fjällräven Foldsack' }],
      ['tshirt', { title: 'Slim Fit T-Shirts' }],
      ['tshirt', { title: 'Womens T Shirt' }],
      ['backpack', { title: 'Back Pack' }],
      ['JACKET', { title: 'rain jacket' }],
    ])('%j matches %j', (q, text) => {
      expect(matches(q, text)).toBe(true);
    });
  });

  it('requires every term to match a word', () => {
    expect(matches('men jacket', { title: "Men's Cotton Jacket" })).toBe(true);
    expect(matches('men jacket', { title: "Women's Jacket" })).toBe(false);
  });

  it('does not throw on regex special characters', () => {
    for (const q of ['(', '[', '*', '+', '?', '\\', '.*', 'a|b', '$^']) {
      expect(() => matches(q, { title: 'anything' })).not.toThrow();
    }
  });

  it('matches nothing when the query has no searchable characters', async () => {
    const catalog = new CatalogService(new FixtureProductRepository([product({ id: 1 })]), options);
    expect(await catalog.search('!!!')).toEqual([]);
  });
});
