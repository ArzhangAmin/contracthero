'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '6px 14px',
    fontSize: '13px',
    borderRadius: 'var(--radius-sm)',
  },
  md: {
    padding: '10px 20px',
    fontSize: '15px',
    borderRadius: 'var(--radius-md)',
  },
  lg: {
    padding: '14px 28px',
    fontSize: '17px',
    borderRadius: 'var(--radius-md)',
  },
};

const BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-family)',
  fontWeight: 500,
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  outline: 'none',
  userSelect: 'none',
};

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color: '#ffffff',
    borderColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  },
};

const VARIANT_HOVER_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary-hover)',
  },
  ghost: {
    backgroundColor: 'var(--color-surface)',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...rest
}: ButtonProps): React.ReactElement {
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>): void => {
    setIsHovered(true);
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>): void => {
    setIsHovered(false);
    onMouseLeave?.(e);
  };

  const computedStyle: React.CSSProperties = {
    ...BASE_STYLE,
    ...SIZE_STYLES[size],
    ...VARIANT_STYLE[variant],
    ...(isHovered && !disabled ? VARIANT_HOVER_STYLE[variant] : {}),
    ...(disabled
      ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
      : {}),
    ...style,
  };

  return (
    <button
      style={computedStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
