import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { ContractsTable } from '@/components/contracts/ContractsTable';
import { FilterBar } from '@/components/contracts/FilterBar';
import { Pagination } from '@/components/contracts/Pagination';
import { ContractsEmptyState } from '@/components/contracts/ContractsEmptyState';
import { contractsRepository } from '@/domain/contracts/repository';
import {
  parseContractsSearchParams,
  type RawSearchParams,
} from '@/lib/contracts-search-params';

interface ContractsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

function hasActiveFilters(params: ReturnType<typeof parseContractsSearchParams>): boolean {
  return Boolean(params.status || params.search || params.endDateFrom || params.endDateTo);
}

export default async function ContractsPage({ params, searchParams }: ContractsPageProps) {
  const [{ locale }, rawSearchParams] = await Promise.all([params, searchParams]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const parsed = parseContractsSearchParams(rawSearchParams);
  const page = await contractsRepository.list({
    page: parsed.page,
    pageSize: parsed.pageSize,
    sort: parsed.sort,
    direction: parsed.direction,
    status: parsed.status,
    search: parsed.search,
    endDateFrom: parsed.endDateFrom,
    endDateTo: parsed.endDateTo,
  });

  const t = await getTranslations('contracts');

  return (
    <main className="contracts-page">
      <header className="contracts-page__header">
        <h1>{t('title')}</h1>
        <p className="contracts-page__subtitle">{t('subtitle')}</p>
      </header>

      <FilterBar searchParams={parsed} />

      {page.items.length === 0 ? (
        <ContractsEmptyState hasActiveFilters={hasActiveFilters(parsed)} />
      ) : (
        <>
          <ContractsTable contracts={page.items} searchParams={parsed} />
          <Pagination
            searchParams={parsed}
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
          />
        </>
      )}
    </main>
  );
}
