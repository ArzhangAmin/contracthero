import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Card } from '@contracthero/ui';

interface AuthLayoutProps {
  children: ReactNode;
}

const CONTAINER_STYLE: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  backgroundColor: 'var(--color-background)',
};

const INNER_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '28rem',
};

export default function AuthLayout({ children }: AuthLayoutProps): ReactElement {
  return (
    <main style={CONTAINER_STYLE}>
      <div style={INNER_STYLE}>
        <Card>{children}</Card>
      </div>
    </main>
  );
}
