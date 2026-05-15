import React from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  describe('render', () => {
    it('renders an input element', () => {
      render(<Input />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });
  });

  describe('label', () => {
    it('renders label when provided', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('does not render label element when label is not provided', () => {
      render(<Input />);
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });

    it('associates label with input via htmlFor', () => {
      render(<Input label="Username" />);
      const label = screen.getByText('Username');
      const input = screen.getByRole('textbox');
      expect(label).toHaveAttribute('for', input.id);
    });
  });

  describe('error state', () => {
    it('shows error message when error prop is provided', () => {
      render(<Input label="Email" error="Invalid email" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    });

    it('applies error border color when error prop is provided', () => {
      render(<Input label="Email" error="Required" />);
      const input = screen.getByRole('textbox');
      // jsdom does not resolve CSS custom properties — check inline style attribute directly
      expect(input.getAttribute('style')).toContain('border-color: var(--color-error)');
    });

    it('sets aria-invalid when error is present', () => {
      render(<Input label="Email" error="Invalid" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not show error when error is not provided', () => {
      render(<Input label="Email" />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('helperText', () => {
    it('shows helperText when provided and no error', () => {
      render(<Input label="Password" helperText="Must be 8 characters" />);
      expect(screen.getByText('Must be 8 characters')).toBeInTheDocument();
    });

    it('does not show helperText when error is present', () => {
      render(<Input label="Password" helperText="Helper" error="Error!" />);
      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    });
  });
});
