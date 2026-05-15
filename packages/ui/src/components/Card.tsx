import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const CARD_BASE_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-sm)',
  padding: '24px',
  border: '1px solid var(--color-border)',
};

export function Card({ children, className, style }: CardProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{ ...CARD_BASE_STYLE, ...style }}
    >
      {children}
    </div>
  );
}
