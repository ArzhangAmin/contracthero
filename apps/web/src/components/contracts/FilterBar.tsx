'use client';

import { useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { CONTRACT_STATUSES, isContractStatus, type ContractStatus } from '@/domain/contracts/contract';
import {
  buildContractsQueryString,
  type ContractsSearchParams,
} from '@/lib/contracts-search-params';

interface FilterBarProps {
  readonly searchParams: ContractsSearchParams;
}

const STATUS_FIELD = 'status';
const SEARCH_FIELD = 'search';
const END_DATE_FROM_FIELD = 'endDateFrom';
const END_DATE_TO_FIELD = 'endDateTo';
const CONTRACTS_PATH = '/contracts';

/**
 * URL-driven filter bar for the Contract List page.
 *
 * Every interaction navigates to a new URL — the page is a Server
 * Component, so the URL is the single source of truth. We use a
 * `useTransition` so the UI can show a pending state while the new
 * server response streams in.
 */
export function FilterBar({ searchParams }: FilterBarProps): React.ReactElement {
  const t = useTranslations('contracts.filters');
  const tStatus = useTranslations('contracts.status');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (qs: string): void => {
    startTransition(() => {
      router.replace(`${CONTRACTS_PATH}${qs}`);
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const statusValue = data.get(STATUS_FIELD);
    const search = (data.get(SEARCH_FIELD) ?? '').toString().trim();
    const from = (data.get(END_DATE_FROM_FIELD) ?? '').toString();
    const to = (data.get(END_DATE_TO_FIELD) ?? '').toString();

    const qs = buildContractsQueryString(searchParams, {
      page: 1,
      status: isContractStatus(statusValue) ? statusValue : null,
      search: search === '' ? null : search,
      endDateFrom: from === '' ? null : from,
      endDateTo: to === '' ? null : to,
    });
    navigate(qs);
  };

  const onStatusChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const value = event.target.value;
    const qs = buildContractsQueryString(searchParams, {
      page: 1,
      status: isContractStatus(value) ? value : null,
    });
    navigate(qs);
  };

  const onReset = (): void => {
    navigate('');
  };

  return (
    <form className="contracts-filters" onSubmit={onSubmit} aria-label={t('ariaLabel')} data-pending={isPending}>
      <div className="contracts-filters__field">
        <label htmlFor="contracts-filter-search">{t('search')}</label>
        <input
          id="contracts-filter-search"
          type="search"
          name={SEARCH_FIELD}
          defaultValue={searchParams.search ?? ''}
          placeholder={t('searchPlaceholder')}
        />
      </div>

      <div className="contracts-filters__field">
        <label htmlFor="contracts-filter-status">{t('status')}</label>
        <select
          id="contracts-filter-status"
          name={STATUS_FIELD}
          defaultValue={searchParams.status ?? ''}
          onChange={onStatusChange}
        >
          <option value="">{t('statusAll')}</option>
          {CONTRACT_STATUSES.map((status: ContractStatus) => (
            <option key={status} value={status}>
              {tStatus(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="contracts-filters__field">
        <label htmlFor="contracts-filter-from">{t('endDateFrom')}</label>
        <input
          id="contracts-filter-from"
          type="date"
          name={END_DATE_FROM_FIELD}
          defaultValue={searchParams.endDateFrom ?? ''}
        />
      </div>

      <div className="contracts-filters__field">
        <label htmlFor="contracts-filter-to">{t('endDateTo')}</label>
        <input
          id="contracts-filter-to"
          type="date"
          name={END_DATE_TO_FIELD}
          defaultValue={searchParams.endDateTo ?? ''}
        />
      </div>

      <div className="contracts-filters__actions">
        <button type="submit" disabled={isPending}>
          {t('apply')}
        </button>
        <button type="button" onClick={onReset} disabled={isPending}>
          {t('reset')}
        </button>
      </div>
    </form>
  );
}
