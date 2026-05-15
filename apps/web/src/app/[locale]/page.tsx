import { useTranslations } from 'next-intl';
import { Button } from '@contracthero/ui';
import { Card } from '@contracthero/ui';
import type React from 'react';

const CONTAINER_STYLE: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--spacing-8)',
  backgroundColor: 'var(--color-background)',
};

const INNER_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: '42rem',
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-4xl)',
  fontWeight: 'var(--font-weight-bold)' as React.CSSProperties['fontWeight'],
  color: 'var(--color-text)',
  marginBottom: 'var(--spacing-4)',
  lineHeight: 'var(--line-height-tight)',
};

const TAGLINE_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--spacing-8)',
  lineHeight: 'var(--line-height-relaxed)',
};

const BUTTON_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--spacing-4)',
  flexWrap: 'wrap',
};

export default function HomePage() {
  const t = useTranslations('common');

  return (
    <main style={CONTAINER_STYLE}>
      <div style={INNER_STYLE}>
        <Card>
          <h1 style={HEADING_STYLE}>{t('appName')}</h1>
          <p style={TAGLINE_STYLE}>{t('tagline')}</p>
          <div style={BUTTON_GROUP_STYLE}>
            <Button variant="primary" size="lg">
              {t('appName')}
            </Button>
            <Button variant="ghost" size="lg">
              {t('tagline')}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
