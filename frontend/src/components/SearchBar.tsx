import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const MAX_QUERY_LENGTH = 100;

/** Search runs on submit (button or Enter), not on every keystroke. */
export function SearchBar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [value, setValue] = useState(urlQuery);

  // Keep the box in sync when the URL changes (back button, shared link).
  useEffect(() => setValue(urlQuery), [urlQuery]);

  const trimmed = value.trim();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    navigate(`/search?${new URLSearchParams({ q: trimmed })}`);
  }

  return (
    <form role="search" className="search" onSubmit={onSubmit}>
      <label htmlFor="search-input" className="visually-hidden">
        Search products
      </label>
      <input
        id="search-input"
        type="search"
        placeholder="Search products"
        value={value}
        maxLength={MAX_QUERY_LENGTH}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" disabled={!trimmed}>
        Search
      </button>
    </form>
  );
}
