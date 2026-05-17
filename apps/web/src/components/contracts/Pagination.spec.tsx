import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { parseContractsSearchParams } from '@/lib/contracts-search-params';
import messages from '../../../messages/en.json';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// eslint-disable-next-line import/first
import { Pagination } from './Pagination';

function renderPagination(props: { page: number; totalPages: number; total: number; raw?: Record<string, string> }) {
  const searchParams = parseContractsSearchParams(props.raw ?? {});
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Pagination
        searchParams={searchParams}
        page={props.page}
        totalPages={props.totalPages}
        total={props.total}
      />
    </NextIntlClientProvider>,
  );
}

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = renderPagination({ page: 1, totalPages: 1, total: 5 });
    expect(container.firstChild).toBeNull();
  });

  it('disables the previous link on the first page', () => {
    renderPagination({ page: 1, totalPages: 3, total: 25 });
    const prev = screen.getByText(messages.contracts.pagination.previous);
    expect(prev.tagName.toLowerCase()).toBe('span');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the next link on the last page', () => {
    renderPagination({ page: 3, totalPages: 3, total: 25 });
    const next = screen.getByText(messages.contracts.pagination.next);
    expect(next.tagName.toLowerCase()).toBe('span');
    expect(next).toHaveAttribute('aria-disabled', 'true');
  });

  it('preserves existing filters when building prev/next hrefs', () => {
    renderPagination({ page: 2, totalPages: 3, total: 25, raw: { status: 'active', search: 'lease' } });
    const prev = screen.getByText(messages.contracts.pagination.previous) as HTMLAnchorElement;
    const next = screen.getByText(messages.contracts.pagination.next) as HTMLAnchorElement;

    expect(prev.getAttribute('href')).toBe('/contracts?status=active&search=lease');
    const nextParams = new URLSearchParams((next.getAttribute('href') ?? '').split('?')[1]);
    expect(nextParams.get('page')).toBe('3');
    expect(nextParams.get('status')).toBe('active');
    expect(nextParams.get('search')).toBe('lease');
  });
});
