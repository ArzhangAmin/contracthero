import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  describe('render', () => {
    it('renders without crashing', () => {
      render(<Card>Content</Card>);
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Card>
          <p>Paragraph inside card</p>
          <span>Span inside card</span>
        </Card>,
      );
      expect(screen.getByText('Paragraph inside card')).toBeInTheDocument();
      expect(screen.getByText('Span inside card')).toBeInTheDocument();
    });
  });

  describe('className', () => {
    it('applies custom className when provided', () => {
      const { container } = render(<Card className="custom-class">Test</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders without className when not provided', () => {
      const { container } = render(<Card>Test</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toBe('');
    });
  });

  describe('styles', () => {
    it('applies base card styles', () => {
      const { container } = render(<Card>Styled</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ backgroundColor: 'var(--color-surface)' });
      expect(card).toHaveStyle({ borderRadius: 'var(--radius-md)' });
    });

    it('merges custom style prop with base styles', () => {
      const { container } = render(<Card style={{ padding: '48px' }}>Custom</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ padding: '48px' });
    });
  });
});
