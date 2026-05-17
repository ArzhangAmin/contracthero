import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { parseContractsSearchParams } from '@/lib/contracts-search-params';
import messages from '../../../messages/en.json';

const replace = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// eslint-disable-next-line import/first
import { FilterBar } from './FilterBar';

function renderBar(raw: Record<string, string> = {}) {
  const searchParams = parseContractsSearchParams(raw);
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FilterBar searchParams={searchParams} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
});

describe('FilterBar', () => {
  it('navigates with a non-default status when the select changes', () => {
    renderBar();
    const select = screen.getByLabelText(messages.contracts.filters.status) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'active' } });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toBe('/contracts?status=active');
  });

  it('clears status when "All" is picked', () => {
    renderBar({ status: 'active' });
    const select = screen.getByLabelText(messages.contracts.filters.status) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '' } });
    expect(replace).toHaveBeenCalledWith('/contracts');
  });

  it('builds a query string from the submitted form', () => {
    renderBar();
    const search = screen.getByLabelText(messages.contracts.filters.search) as HTMLInputElement;
    fireEvent.change(search, { target: { value: '  lease  ' } });

    const from = screen.getByLabelText(messages.contracts.filters.endDateFrom) as HTMLInputElement;
    fireEvent.change(from, { target: { value: '2025-01-01' } });

    fireEvent.submit(search.closest('form') as HTMLFormElement);

    expect(replace).toHaveBeenCalledTimes(1);
    const href = replace.mock.calls[0][0] as string;
    expect(href.startsWith('/contracts?')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('search')).toBe('lease');
    expect(params.get('endDateFrom')).toBe('2025-01-01');
  });

  it('resets all filters via the reset button', () => {
    renderBar({ status: 'active', search: 'lease' });
    fireEvent.click(screen.getByRole('button', { name: messages.contracts.filters.reset }));
    expect(replace).toHaveBeenCalledWith('/contracts');
  });
});
