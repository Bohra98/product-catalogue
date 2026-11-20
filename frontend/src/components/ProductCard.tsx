import { Link } from 'react-router-dom';
import type { Product } from '../api/types';
import { formatPrice, formatRating } from '../format';

/** The whole tile is one link, so clicking anywhere on it opens the product. */
export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="card">
      <Link to={`/products/${product.id}`} className="card__link">
        <div className="card__media">
          <img src={product.imageUrl} alt="" loading="lazy" />
        </div>
        <div className="card__body">
          <h3 className="card__title">{product.title}</h3>
          <p className="card__meta">
            <span className="card__price">{formatPrice(product.price)}</span>
            <span className="card__rating" aria-label={formatRating(product.rating.rate, product.rating.count)}>
              ★ {product.rating.rate.toFixed(1)}
            </span>
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ProductGrid({ products, label }: { products: Product[]; label: string }) {
  return (
    <ul className="grid" aria-label={label}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}
