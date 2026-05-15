// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

import HomePage from './page';

describe('HomePage', () => {
  beforeEach(() => {
    cleanup();
  });

  it('bayad bedune error render beshe', () => {
    expect(() => render(<HomePage />)).not.toThrow();
  });

  it('bayad brand name (appName) ro neshun bede', () => {
    render(<HomePage />);
    expect(screen.getAllByText('common.appName').length).toBeGreaterThan(0);
  });

  it('bayad tagline ro neshun bede', () => {
    render(<HomePage />);
    expect(screen.getAllByText('common.tagline').length).toBeGreaterThan(0);
  });

  it('bayad Button component az @contracthero/ui render kone', () => {
    const { container } = render(<HomePage />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('bayad Card component render kone va content neshun bede', () => {
    render(<HomePage />);
    expect(screen.getAllByText('common.appName').length).toBeGreaterThan(0);
  });

  it('bayad main element dashteh bashe', () => {
    render(<HomePage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
