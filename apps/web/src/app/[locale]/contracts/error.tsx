'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ContractsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary shown when the Contract List page throws.
 *
 * Next.js wraps every route segment in an error boundary that
 * renders this component; we use it to surface a friendly message
 * and a retry action.
 */
export default function ContractsError({ error, reset }: ContractsErrorProps): React.ReactElement {
  const t = useTranslations('contracts.error');

  useEffect(() => {
    // The framework already logs server-side. Surface client-side
    // failures to the browser console so QA can grab the digest.
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[contracts] page error', { message: error.message, digest: error.digest });
    }
  }, [error]);

  return (
    <div className="contracts-error" role="alert">
      <h2 className="contracts-error__title">{t('title')}</h2>
      <p className="contracts-error__message">{t('message')}</p>
      {error.digest ? (
        <p className="contracts-error__digest" data-testid="error-digest">
          {t('digest', { digest: error.digest })}
        </p>
      ) : null}
      <button type="button" onClick={reset} className="contracts-error__retry">
        {t('retry')}
      </button>
    </div>
  );
}
