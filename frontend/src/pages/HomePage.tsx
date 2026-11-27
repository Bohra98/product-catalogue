import { api } from '../api/client';
import { ProductGrid } from '../components/ProductCard';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

export function HomePage() {
  const featured = useAsync(() => api.getFeatured(), []);

  return (
    <>
      <h1>Top rated</h1>
      {featured.status === 'loading' && <Loading />}
      {featured.status === 'error' && <ErrorMessage error={featured.error} />}
      {featured.status === 'success' && <ProductGrid products={featured.data} label="Top rated products" />}
    </>
  );
}
