import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DeadlineStatusBadge } from './DeadlineStatusBadge';
import messages from '../../../messages/en.json';

function renderBadge(status: 'expired' | 'due_today' | 'due_soon' | 'on_track') {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeadlineStatusBadge status={status} />
    </NextIntlClientProvider>,
  );
}

describe('DeadlineStatusBadge', () => {
  it('renders the localised label and a data attribute for each status', () => {
    renderBadge('expired');
    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('data-status', 'expired');
    expect(node.textContent).toBe(messages.contracts.deadline.expired);
  });

  it('applies a status-specific class for "due_soon"', () => {
    renderBadge('due_soon');
    expect(screen.getByRole('status').className).toContain('badge--due-soon');
  });
});
