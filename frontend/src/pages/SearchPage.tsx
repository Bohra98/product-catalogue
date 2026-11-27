import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ProductGrid } from '../components/ProductCard';
import { MAX_QUERY_LENGTH } from '../components/SearchBar';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  // A hand-edited URL can exceed the input's maxLength. Say why here instead
  // of showing the API's generic "Request is invalid".
  const tooLong = query.length > MAX_QUERY_LENGTH;
  const results = useAsync(
    () => (query && !tooLong ? api.search(query) : Promise.resolve([])),
    [query, tooLong],
  );

  if (tooLong) {
    return (
      <>
        <h1>Search</h1>
        <p className="status status--error" role="alert">
          Search term must be {MAX_QUERY_LENGTH} characters or fewer.
        </p>
      </>
    );
  }

  if (!query) {
    return (
      <>
        <h1>Search</h1>
        <p>Enter a search term above.</p>
      </>
    );
  }

  return (
    <>
      <h1>Results for “{query}”</h1>
      {results.status === 'loading' && <Loading label="Searching…" />}
      {results.status === 'error' && <ErrorMessage error={results.error} />}
      {results.status === 'success' &&
        (results.data.length === 0 ? (
          <p role="status">No products match “{query}”.</p>
        ) : (
          <>
            <p role="status">
              {results.data.length} {results.data.length === 1 ? 'product' : 'products'} found
            </p>
            <ProductGrid products={results.data} label="Search results" />
          </>
        ))}
    </>
  );
}
