import { useTranslations } from 'next-intl';
import type { DeadlineStatus } from '@/domain/contracts/deadline';

interface DeadlineStatusBadgeProps {
  readonly status: DeadlineStatus;
}

const STATUS_CLASS: Readonly<Record<DeadlineStatus, string>> = {
  expired: 'badge badge--expired',
  due_today: 'badge badge--due-today',
  due_soon: 'badge badge--due-soon',
  on_track: 'badge badge--on-track',
};

/**
 * Renders a colour-coded badge for a contract's deadline bucket.
 *
 * The status is passed in (computed server-side) instead of recomputed
 * here so the markup is fully deterministic and avoids React hydration
 * mismatches.
 */
export function DeadlineStatusBadge({ status }: DeadlineStatusBadgeProps): React.ReactElement {
  const t = useTranslations('contracts.deadline');
  return (
    <span className={STATUS_CLASS[status]} data-status={status} role="status">
      {t(status)}
    </span>
  );
}
