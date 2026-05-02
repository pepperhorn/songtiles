import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tray } from '../../src/components/Tray';
import { useAppStore } from '../../src/state/store';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('<Tray>', () => {
  beforeEach(() => {
    useAppStore.getState().initSession({ trayCapacity: 8, repeatPoolSize: 5 });
  });

  it('renders one button per tray tile', () => {
    render(<ThemeProvider><Tray /></ThemeProvider>);
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(8);
  });

  it('refill draws back to capacity after discard', async () => {
    render(<ThemeProvider><Tray /></ThemeProvider>);
    const slots = screen.getAllByRole('button', { name: /tray tile/i });
    await userEvent.dblClick(slots[0]);
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: /refill/i }));
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(8);
  });
});
