import React from 'react';

export function Button({ children, variant, size }: { children: React.ReactNode; variant?: string; size?: string }) {
  return React.createElement('button', { 'data-variant': variant, 'data-size': size }, children);
}

export function Card({ children }: { children: React.ReactNode }) {
  return React.createElement('div', { 'data-testid': 'card' }, children);
}

export function Input({ placeholder }: { placeholder?: string }) {
  return React.createElement('input', { placeholder });
}
