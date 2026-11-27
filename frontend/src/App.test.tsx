import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { ApiError, api } from './api/client';
import { electronics, jewelery, makeProduct } from './test/fixtures';

// Tests stub the API client module boundary, not fetch: the components only
// know about `api`, so that is the seam that matters.
vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    api: {
      getFeatured: vi.fn(),
      getCategories: vi.fn(),
      getCategoryProducts: vi.fn(),
      search: vi.fn(),
      getProduct: vi.fn(),
      submitEnquiry: vi.fn(),
    },
  };
});

const mocked = vi.mocked(api);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const featured = [1, 2, 3, 4, 5].map((id) => makeProduct(id, { title: `Featured ${id}` }));

beforeEach(() => {
  mocked.getCategories.mockResolvedValue([electronics, jewelery]);
  mocked.getFeatured.mockResolvedValue(featured);
});

describe('Home page', () => {
  it('shows the 5 featured products', async () => {
    renderAt('/');
    const grid = await screen.findByRole('list', { name: 'Top rated products' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(5);
    expect(within(grid).getByText('Featured 1')).toBeInTheDocument();
  });

  it('shows a readable error when the API fails', async () => {
    mocked.getFeatured.mockRejectedValue(new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Product data is temporarily unavailable.'));
    renderAt('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
  });
});

describe('Category page', () => {
  it('opens from the nav and shows top-rated plus additional products', async () => {
    mocked.getCategoryProducts.mockResolvedValue({
      category: jewelery,
      featured: [makeProduct(10, { title: 'Gold Ring', category: jewelery })],
      others: [makeProduct(11, { title: 'Silver Chain', category: jewelery })],
    });
    const user = userEvent.setup();
    renderAt('/');

    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    await user.click(await within(nav).findByRole('link', { name: 'jewelery' }));

    expect(mocked.getCategoryProducts).toHaveBeenCalledWith('jewelery');
    const top = await screen.findByRole('list', { name: 'Top rated in jewelery' });
    expect(within(top).getByText('Gold Ring')).toBeInTheDocument();
    const more = screen.getByRole('list', { name: 'More in jewelery' });
    expect(within(more).getByText('Silver Chain')).toBeInTheDocument();
  });
});

describe('Search', () => {
  it('shows only matching products after clicking Search', async () => {
    mocked.search.mockResolvedValue([makeProduct(7, { title: 'Hard Drive' })]);
    const user = userEvent.setup();
    renderAt('/');
    await screen.findByRole('list', { name: 'Top rated products' });

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), '  drive ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(mocked.search).toHaveBeenCalledWith('drive');
    const results = await screen.findByRole('list', { name: 'Search results' });
    expect(within(results).getAllByRole('listitem')).toHaveLength(1);
    expect(within(results).getByText('Hard Drive')).toBeInTheDocument();
    expect(screen.queryByText('Featured 1')).not.toBeInTheDocument();
  });

  it('does not search for a blank term', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const button = screen.getByRole('button', { name: 'Search' });
    await user.type(screen.getByRole('searchbox'), '   ');
    expect(button).toBeDisabled();
    expect(mocked.search).not.toHaveBeenCalled();
  });

  it('tells the user when nothing matches', async () => {
    mocked.search.mockResolvedValue([]);
    renderAt('/search?q=zzz');
    expect(await screen.findByText('No products match “zzz”.')).toBeInTheDocument();
  });

  it('explains an over-long term from the URL without calling the API', async () => {
    renderAt(`/search?q=${'z'.repeat(101)}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Search term must be 100 characters or fewer');
    expect(mocked.search).not.toHaveBeenCalled();
  });

  it('shows a whitespace-only term from the URL as an empty box', async () => {
    renderAt('/search?q=%20%20');
    expect(screen.getByText('Enter a search term above.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(mocked.search).not.toHaveBeenCalled();
  });
});

describe('Product page', () => {
  it('opens when a product tile is clicked', async () => {
    mocked.getProduct.mockResolvedValue(makeProduct(3, { title: 'Featured 3', description: 'Full details here' }));
    const user = userEvent.setup();
    renderAt('/');

    await user.click(await screen.findByRole('link', { name: /Featured 3/ }));

    expect(mocked.getProduct).toHaveBeenCalledWith(3);
    expect(await screen.findByRole('heading', { level: 1, name: 'Featured 3' })).toBeInTheDocument();
    expect(screen.getByText('Full details here')).toBeInTheDocument();
  });

  it('shows not found for an unknown product', async () => {
    mocked.getProduct.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Product not found'));
    renderAt('/products/999');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Enquiry', () => {
  const product = makeProduct(5, { title: 'Featured 5' });

  async function openForm() {
    mocked.getProduct.mockResolvedValue(product);
    const user = userEvent.setup();
    renderAt('/products/5');
    await user.click(await screen.findByRole('button', { name: 'Enquire' }));
    return user;
  }

  it('submits contact details and shows a thank-you message', async () => {
    mocked.submitEnquiry.mockResolvedValue({
      enquiryId: 'abc',
      message: 'Thank you for your enquiry. Our sales team will be in touch shortly.',
    });
    const user = await openForm();

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'Is this in stock?');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(mocked.submitEnquiry).toHaveBeenCalledWith({
      productId: 5,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: undefined,
      message: 'Is this in stock?',
    });
    const thanks = await screen.findByRole('heading', { name: 'Thank you!' });
    expect(thanks).toHaveFocus();
    expect(screen.getByText(/sales team will be in touch/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send enquiry' })).not.toBeInTheDocument();
  });

  it('shows validation errors and does not submit an incomplete form', async () => {
    const user = await openForm();
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(screen.getByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(mocked.submitEnquiry).not.toHaveBeenCalled();
  });

  it('keeps the form and shows the error when sending fails', async () => {
    mocked.submitEnquiry.mockRejectedValue(
      new ApiError(503, 'MAIL_UNAVAILABLE', 'We could not send your enquiry right now. Please try again.'),
    );
    const user = await openForm();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Message'), 'Hi');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not send');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeEnabled());
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
  });
});
