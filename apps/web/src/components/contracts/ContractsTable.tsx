import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Contract, SortDirection, SortField } from '@/domain/contracts/contract';
import { SORTABLE_FIELDS } from '@/domain/contracts/contract';
import { computeDeadlineStatus } from '@/domain/contracts/deadline';
import {
  buildContractsQueryString,
  type ContractsSearchParams,
} from '@/lib/contracts-search-params';
import { DeadlineStatusBadge } from './DeadlineStatusBadge';

interface ContractsTableProps {
  readonly contracts: readonly Contract[];
  readonly searchParams: ContractsSearchParams;
  /** Injection seam for deterministic deadline badges in tests. */
  readonly now?: Date;
}

function nextDirection(field: SortField, current: ContractsSearchParams): SortDirection {
  if (current.sort !== field) {
    return 'asc';
  }
  return current.direction === 'asc' ? 'desc' : 'asc';
}

function ariaSort(field: SortField, current: ContractsSearchParams): 'ascending' | 'descending' | 'none' {
  if (current.sort !== field) {
    return 'none';
  }
  return current.direction === 'asc' ? 'ascending' : 'descending';
}

/**
 * Server component that renders the list of contracts as an accessible
 * sortable table. Column headers are anchor links so sorting is
 * fully URL-driven and works without JavaScript.
 */
export function ContractsTable({ contracts, searchParams, now }: ContractsTableProps): React.ReactElement {
  const t = useTranslations('contracts');
  const format = useFormatter();
  const referenceDate = now ?? new Date();

  return (
    <table className="contracts-table" aria-label={t('table.caption')}>
      <caption className="sr-only">{t('table.caption')}</caption>
      <thead>
        <tr>
          {SORTABLE_FIELDS.map((field) => {
            const direction = nextDirection(field, searchParams);
            const qs = buildContractsQueryString(searchParams, {
              sort: field,
              direction,
              page: 1,
            });
            const isActive = searchParams.sort === field;
            return (
              <th key={field} scope="col" aria-sort={ariaSort(field, searchParams)}>
                <Link
                  href={`/contracts${qs}`}
                  className="contracts-table__sort-link"
                  data-active={isActive}
                  data-direction={isActive ? searchParams.direction : undefined}
                >
                  {t(`columns.${field}`)}
                  {isActive ? <span aria-hidden="true">{searchParams.direction === 'asc' ? ' ▲' : ' ▼'}</span> : null}
                </Link>
              </th>
            );
          })}
          <th scope="col">{t('columns.status')}</th>
          <th scope="col">{t('columns.deadlineStatus')}</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((contract) => (
          <tr key={contract.id} data-contract-id={contract.id}>
            <td>{contract.title}</td>
            <td>{contract.counterparty}</td>
            <td>{format.dateTime(new Date(contract.endDate), { dateStyle: 'medium' })}</td>
            <td>
              {format.number(contract.value, {
                style: 'currency',
                currency: contract.currency,
                maximumFractionDigits: 0,
              })}
            </td>
            <td>{t(`status.${contract.status}`)}</td>
            <td>
              <DeadlineStatusBadge status={computeDeadlineStatus(contract.endDate, referenceDate)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
