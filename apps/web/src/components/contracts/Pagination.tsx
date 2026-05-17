import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  buildContractsQueryString,
  type ContractsSearchParams,
} from '@/lib/contracts-search-params';

interface PaginationProps {
  readonly searchParams: ContractsSearchParams;
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
}

const CONTRACTS_PATH = '/contracts';

/**
 * Renders accessible Previous / Next / page links for the Contract
 * List page. Pagination state lives in the URL so links work without
 * JavaScript and are crawlable.
 */
export function Pagination({ searchParams, page, totalPages, total }: PaginationProps): React.ReactElement | null {
  const t = useTranslations('contracts.pagination');

  if (totalPages <= 1) {
    return null;
  }

  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const prevHref = `${CONTRACTS_PATH}${buildContractsQueryString(searchParams, { page: prevPage })}`;
  const nextHref = `${CONTRACTS_PATH}${buildContractsQueryString(searchParams, { page: nextPage })}`;
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav className="contracts-pagination" aria-label={t('ariaLabel')}>
      {isFirst ? (
        <span className="contracts-pagination__link contracts-pagination__link--disabled" aria-disabled="true">
          {t('previous')}
        </span>
      ) : (
        <Link href={prevHref} className="contracts-pagination__link" rel="prev">
          {t('previous')}
        </Link>
      )}

      <span className="contracts-pagination__summary" aria-live="polite">
        {t('summary', { page, totalPages, total })}
      </span>

      {isLast ? (
        <span className="contracts-pagination__link contracts-pagination__link--disabled" aria-disabled="true">
          {t('next')}
        </span>
      ) : (
        <Link href={nextHref} className="contracts-pagination__link" rel="next">
          {t('next')}
        </Link>
      )}
    </nav>
  );
}
