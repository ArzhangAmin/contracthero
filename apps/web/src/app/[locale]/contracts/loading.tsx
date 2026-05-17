import { useTranslations } from 'next-intl';

const SKELETON_ROWS = 6;

/**
 * Loading skeleton shown while the Contract List page streams in.
 *
 * Rendered by Next.js's App Router automatically when `page.tsx`
 * is suspended on a server-side data fetch.
 */
export default function ContractsLoading(): React.ReactElement {
  const t = useTranslations('contracts.loading');
  const rows = Array.from({ length: SKELETON_ROWS }, (_, index) => index);

  return (
    <div className="contracts-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('label')}</span>
      <ul className="contracts-loading__list">
        {rows.map((index) => (
          <li key={index} className="contracts-loading__row" aria-hidden="true" />
        ))}
      </ul>
    </div>
  );
}
