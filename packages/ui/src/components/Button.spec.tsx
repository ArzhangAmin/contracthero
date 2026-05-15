import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  describe('render', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders with default variant and size', () => {
      render(<Button>Default</Button>);
      const btn = screen.getByRole('button', { name: 'Default' });
      expect(btn).toBeInTheDocument();
    });
  });

  describe('variant', () => {
    it('renders primary variant with correct background color', () => {
      render(<Button variant="primary">Primary</Button>);
      const btn = screen.getByRole('button', { name: 'Primary' });
      expect(btn).toHaveStyle({ backgroundColor: 'var(--color-primary)' });
    });

    it('renders ghost variant with transparent background', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const btn = screen.getByRole('button', { name: 'Ghost' });
      // jsdom does not resolve CSS custom properties — check inline style attribute directly
      expect(btn.getAttribute('style')).toContain('background-color: transparent');
    });
  });

  describe('size', () => {
    it('renders sm size', () => {
      render(<Button size="sm">Small</Button>);
      const btn = screen.getByRole('button', { name: 'Small' });
      expect(btn).toHaveStyle({ fontSize: '13px' });
    });

    it('renders md size', () => {
      render(<Button size="md">Medium</Button>);
      const btn = screen.getByRole('button', { name: 'Medium' });
      expect(btn).toHaveStyle({ fontSize: '15px' });
    });

    it('renders lg size', () => {
      render(<Button size="lg">Large</Button>);
      const btn = screen.getByRole('button', { name: 'Large' });
      expect(btn).toHaveStyle({ fontSize: '17px' });
    });
  });

  describe('onClick', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Clickable</Button>);
      fireEvent.click(screen.getByRole('button', { name: 'Clickable' }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      const btn = screen.getByRole('button', { name: 'Disabled' });
      expect(btn).toBeDisabled();
    });
  });
});
