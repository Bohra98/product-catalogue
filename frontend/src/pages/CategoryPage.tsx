import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ProductGrid } from '../components/ProductCard';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

export function CategoryPage() {
  const { slug = '' } = useParams();
  const result = useAsync(() => api.getCategoryProducts(slug), [slug]);

  if (result.status === 'loading') return <Loading />;
  if (result.status === 'error') return <ErrorMessage error={result.error} />;

  const { category, featured, others } = result.data;
  return (
    <>
      <h1 className="capitalize">{category.name}</h1>
      <section aria-labelledby="cat-featured">
        <h2 id="cat-featured">Top rated in {category.name}</h2>
        <ProductGrid products={featured} label={`Top rated in ${category.name}`} />
      </section>
      {others.length > 0 && (
        <section aria-labelledby="cat-more">
          <h2 id="cat-more">More in {category.name}</h2>
          <ProductGrid products={others} label={`More in ${category.name}`} />
        </section>
      )}
    </>
  );
}
