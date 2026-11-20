import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import type { Product } from '../api/types';
import { EnquiryForm } from '../components/EnquiryForm';
import { ErrorMessage, Loading } from '../components/Status';
import { formatPrice, formatRating } from '../format';
import { useAsync } from '../hooks/useAsync';
import { NotFoundPage } from './NotFoundPage';

export function ProductPage() {
  const { id = '' } = useParams();
  const productId = /^\d+$/.test(id) ? Number(id) : null;
  const result = useAsync(
    () => (productId === null ? Promise.resolve(null) : api.getProduct(productId)),
    [productId],
  );

  if (productId === null) return <NotFoundPage />;
  if (result.status === 'loading') return <Loading />;
  if (result.status === 'error') {
    if (result.error instanceof ApiError && result.error.status === 404) return <NotFoundPage />;
    return <ErrorMessage error={result.error} />;
  }
  if (!result.data) return <NotFoundPage />;

  // Keyed so the enquiry form resets when moving between products.
  return <ProductDetails key={result.data.id} product={result.data} />;
}

function ProductDetails({ product }: { product: Product }) {
  const [enquiring, setEnquiring] = useState(false);

  return (
    <article className="product">
      <div className="product__media">
        <img src={product.imageUrl} alt={product.title} />
      </div>
      <div className="product__info">
        <p className="product__category">
          <Link to={`/categories/${product.category.slug}`} className="capitalize">
            {product.category.name}
          </Link>
        </p>
        <h1>{product.title}</h1>
        <p className="product__price">{formatPrice(product.price)}</p>
        <p className="product__rating">★ {formatRating(product.rating.rate, product.rating.count)}</p>
        <p className="product__description">{product.description}</p>

        {!enquiring && (
          <button type="button" className="button button--primary" onClick={() => setEnquiring(true)}>
            Enquire
          </button>
        )}
        {enquiring && <EnquiryForm product={product} />}
      </div>
    </article>
  );
}
