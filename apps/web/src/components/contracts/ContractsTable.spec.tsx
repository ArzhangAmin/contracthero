import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { Contract } from '@/domain/contracts/contract';
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
import { ContractsTable } from './ContractsTable';

const SAMPLE: readonly Contract[] = [
  {
    id: '1',
    title: 'Alpha Lease',
    counterparty: 'Zeta GmbH',
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2025-06-30',
    value: 1000,
    currency: 'EUR',
  },
  {
    id: '2',
    title: 'Beta Subscription',
    counterparty: 'Alpha AG',
    status: 'draft',
    startDate: '2024-02-01',
    endDate: '2099-01-31',
    value: 500,
    currency: 'EUR',
  },
];

function renderTable(searchParamsRaw: Record<string, string> = {}) {
  const searchParams = parseContractsSearchParams(searchParamsRaw);
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContractsTable contracts={SAMPLE} searchParams={searchParams} now={new Date('2025-06-15T00:00:00Z')} />
    </NextIntlClientProvider>,
  );
}

describe('ContractsTable', () => {
  it('renders one row per contract with title and counterparty', () => {
    renderTable();
    const rows = screen.getAllByRole('row');
    // 1 header + 2 body
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Alpha Lease')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Beta Subscription')).toBeInTheDocument();
  });

  it('renders a DeadlineStatusBadge per row computed from now', () => {
    renderTable();
    const badges = screen.getAllByRole('status');
    expect(badges).toHaveLength(2);
    // First row endDate 2025-06-30, now 2025-06-15 -> due_soon
    expect(badges[0]).toHaveAttribute('data-status', 'due_soon');
    // Second row 2099-01-31 -> on_track
    expect(badges[1]).toHaveAttribute('data-status', 'on_track');
  });

  it('marks the active sort column with aria-sort and a direction indicator', () => {
    renderTable({ sort: 'title', dir: 'desc' });
    const titleHeader = screen.getByRole('columnheader', { name: /title/i });
    expect(titleHeader).toHaveAttribute('aria-sort', 'descending');
    const link = within(titleHeader).getByRole('link');
    expect(link).toHaveAttribute('data-active', 'true');
    expect(link).toHaveAttribute('data-direction', 'desc');
  });

  it('toggles the sort direction in the column link when re-clicking the active column', () => {
    renderTable({ sort: 'value', dir: 'asc' });
    const valueHeader = screen.getByRole('columnheader', { name: /value/i });
    const link = within(valueHeader).getByRole('link');
    // active asc -> next href should ask for desc
    expect(link.getAttribute('href')).toMatch(/dir=desc/);
  });
});
