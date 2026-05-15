import { useTranslations } from 'next-intl';

export default function TestPage() {
  const t = useTranslations('common');

  return (
    <main>
      <h2>i18n Test Page</h2>
      <dl>
        <dt>common.appName</dt>
        <dd>{t('appName')}</dd>

        <dt>common.tagline</dt>
        <dd>{t('tagline')}</dd>
      </dl>
    </main>
  );
}
