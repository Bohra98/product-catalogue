import type { Category, Product } from '../api/types';

export const electronics: Category = { slug: 'electronics', name: 'electronics' };
export const jewelery: Category = { slug: 'jewelery', name: 'jewelery' };

export function makeProduct(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `Product ${id}`,
    description: `Description ${id}`,
    price: 10 + id,
    category: electronics,
    rating: { rate: 4, count: 10 },
    imageUrl: `/api/images/${id}`,
    ...overrides,
  };
}
