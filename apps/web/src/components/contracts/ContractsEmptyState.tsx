import { useTranslations } from 'next-intl';

interface ContractsEmptyStateProps {
  readonly hasActiveFilters: boolean;
}

/**
 * Empty state shown when the Contract List query returns zero rows.
 * The copy varies depending on whether the user has any active
 * filters so we can guide them toward a productive next action.
 */
export function ContractsEmptyState({ hasActiveFilters }: ContractsEmptyStateProps): React.ReactElement {
  const t = useTranslations('contracts.empty');
  return (
    <div className="contracts-empty" role="status">
      <h2 className="contracts-empty__title">
        {hasActiveFilters ? t('filteredTitle') : t('title')}
      </h2>
      <p className="contracts-empty__message">
        {hasActiveFilters ? t('filteredMessage') : t('message')}
      </p>
    </div>
  );
}
