import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  children?: never;
}

const WRAPPER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontFamily: 'var(--font-family)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text)',
};

const INPUT_BASE_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '15px',
  fontFamily: 'var(--font-family)',
  color: 'var(--color-text)',
  backgroundColor: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  boxSizing: 'border-box',
};

const INPUT_ERROR_STYLE: React.CSSProperties = {
  borderColor: 'var(--color-error)',
};

const HELPER_TEXT_STYLE: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-text-muted)',
};

const ERROR_TEXT_STYLE: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-error)',
};

export function Input({
  label,
  error,
  helperText,
  id,
  style,
  ...rest
}: InputProps): React.ReactElement {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const inputStyle: React.CSSProperties = {
    ...INPUT_BASE_STYLE,
    ...(error ? INPUT_ERROR_STYLE : {}),
    ...style,
  };

  return (
    <div style={WRAPPER_STYLE}>
      {label && (
        <label htmlFor={inputId} style={LABEL_STYLE}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={inputStyle}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${inputId}-error`
            : helperText
              ? `${inputId}-helper`
              : undefined
        }
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} role="alert" style={ERROR_TEXT_STYLE}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-helper`} style={HELPER_TEXT_STYLE}>
          {helperText}
        </span>
      )}
    </div>
  );
}
