import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to top rated products</Link>
      </p>
    </>
  );
}
