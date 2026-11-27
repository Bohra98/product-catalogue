import { Link, NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { SearchBar } from './SearchBar';

export function Layout() {
  const categories = useAsync(() => api.getCategories(), []);

  return (
    <div className="app">
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="brand">
            Catalogue
          </Link>
          <SearchBar />
        </div>
        <nav aria-label="Categories" className="nav">
          {categories.status === 'success' && (
            <ul>
              {categories.data.map((c) => (
                <li key={c.slug}>
                  <NavLink to={`/categories/${c.slug}`}>{c.name}</NavLink>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
