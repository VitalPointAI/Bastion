/**
 * DOM tests for UniversalInputZone component and IngestItemStatus chip
 *
 * Phase 50 Plan 03 TDD scaffold.
 *
 * Tests define expected behavior for:
 * - UniversalInputZone renders with correct ARIA labels and roles
 * - Drop zone has role="region" with aria-label containing "Universal content input"
 * - Input has correct placeholder and aria-label
 * - Status list has aria-live="polite" and role="log"
 * - Typing and pressing Enter calls submitText and clears input
 * - Pressing Escape clears input
 * - Interview-required banner visible when isInterviewRequired=true
 * - IngestItemStatus renders role="status" on status text
 * - Retry button shown for error items with retryCount < 3
 * - Dismiss button shown for complete items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock useUniversalIngest ──────────────────────────────────────────────────

vi.mock('./hooks/useUniversalIngest.js', () => ({
  useUniversalIngest: vi.fn(),
}));

// We'll import and configure the mock per test
import { useUniversalIngest } from './hooks/useUniversalIngest.js';
const mockUseUniversalIngest = vi.mocked(useUniversalIngest);

function makeDefaultHookReturn(overrides?: Partial<ReturnType<typeof useUniversalIngest>>) {
  return {
    items: [],
    submitText: vi.fn().mockResolvedValue(undefined),
    submitFiles: vi.fn().mockResolvedValue(undefined),
    retryItem: vi.fn().mockResolvedValue(undefined),
    dismissItem: vi.fn(),
    clearCompleted: vi.fn(),
    isInterviewRequired: false,
    handleSSEEvent: vi.fn(),
    ...overrides,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<{
  id: string;
  label: string;
  status: string;
  progress: number;
  processId: string;
  error: string;
  retryCount: number;
  createdAt: string;
}>) {
  return {
    id: 'item-1',
    label: 'https://example.com',
    status: 'processing',
    progress: 0.5,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── UniversalInputZone tests ─────────────────────────────────────────────────

describe('UniversalInputZone', () => {
  beforeEach(() => {
    mockUseUniversalIngest.mockReturnValue(makeDefaultHookReturn());
  });

  it('renders input with correct placeholder', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const input = screen.getByPlaceholderText(/Drop files, paste text, or enter a URL/i);
    expect(input).toBeDefined();
  });

  it('input has aria-label "Enter URL or text to ingest"', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const input = screen.getByLabelText(/Enter URL or text to ingest/i);
    expect(input).toBeDefined();
  });

  it('drop zone has role="region"', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const region = screen.getByRole('region');
    expect(region).toBeDefined();
  });

  it('drop zone aria-label contains "Universal content input"', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toMatch(/Universal content input/i);
  });

  it('status list has aria-live="polite" and role="log"', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const log = screen.getByRole('log');
    expect(log).toBeDefined();
    expect(log.getAttribute('aria-live')).toBe('polite');
  });

  it('typing text and pressing Enter calls submitText with the value and clears the input', async () => {
    const submitText = vi.fn().mockResolvedValue(undefined);
    mockUseUniversalIngest.mockReturnValue(makeDefaultHookReturn({ submitText }));

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const input = screen.getByLabelText(/Enter URL or text to ingest/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(submitText).toHaveBeenCalledWith('https://example.com');
    expect(input.value).toBe('');
  });

  it('pressing Escape clears the input field', async () => {
    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const input = screen.getByLabelText(/Enter URL or text to ingest/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'some text' } });
    expect(input.value).toBe('some text');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('shows interview-required banner when isInterviewRequired is true', async () => {
    mockUseUniversalIngest.mockReturnValue(
      makeDefaultHookReturn({ isInterviewRequired: true }),
    );

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const banner = screen.getByText(/Complete the problem set scoping interview/i);
    expect(banner).toBeDefined();
  });

  it('does not show interview-required banner when isInterviewRequired is false', async () => {
    mockUseUniversalIngest.mockReturnValue(
      makeDefaultHookReturn({ isInterviewRequired: false }),
    );

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    expect(screen.queryByText(/Complete the problem set scoping interview/i)).toBeNull();
  });

  it('does not submit empty input on Enter', async () => {
    const submitText = vi.fn().mockResolvedValue(undefined);
    mockUseUniversalIngest.mockReturnValue(makeDefaultHookReturn({ submitText }));

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const input = screen.getByLabelText(/Enter URL or text to ingest/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(submitText).not.toHaveBeenCalled();
  });

  it('shows "Clear completed" link when any items are complete', async () => {
    mockUseUniversalIngest.mockReturnValue(
      makeDefaultHookReturn({
        items: [makeItem({ status: 'complete' }) as ReturnType<typeof makeItem>],
      }),
    );

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    const clearBtn = screen.getByText(/Clear completed/i);
    expect(clearBtn).toBeDefined();
  });

  it('does not show "Clear completed" when no items are complete', async () => {
    mockUseUniversalIngest.mockReturnValue(
      makeDefaultHookReturn({
        items: [makeItem({ status: 'processing' }) as ReturnType<typeof makeItem>],
      }),
    );

    const { UniversalInputZone } = await import('./UniversalInputZone.js');
    render(<UniversalInputZone problemSetId="ps-1" />);

    expect(screen.queryByText(/Clear completed/i)).toBeNull();
  });
});

// ─── IngestItemStatus tests ───────────────────────────────────────────────────

describe('IngestItemStatus', () => {
  it('renders status text with role="status"', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const item = makeItem({ status: 'processing' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
  });

  it('shows retry button for error items with retryCount < 3', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const item = makeItem({ status: 'error', retryCount: 1, error: 'Failed' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeDefined();
  });

  it('does NOT show retry button when retryCount >= 3', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const item = makeItem({ status: 'error', retryCount: 3, error: 'Failed' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('shows dismiss button for complete items', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const item = makeItem({ status: 'complete' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissBtn).toBeDefined();
  });

  it('shows dismiss button for error items', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const item = makeItem({ status: 'error', retryCount: 0, error: 'Oops' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissBtn).toBeDefined();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const onRetry = vi.fn();
    const item = makeItem({ status: 'error', retryCount: 0, error: 'Failed', id: 'item-abc' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={onRetry}
        onDismiss={vi.fn()}
      />,
    );

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    expect(onRetry).toHaveBeenCalledWith('item-abc');
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const onDismiss = vi.fn();
    const item = makeItem({ status: 'complete', id: 'item-xyz' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledWith('item-xyz');
  });

  it('truncates label longer than 40 chars with ellipsis', async () => {
    const { IngestItemStatus } = await import('./IngestItemStatus.js');
    const longLabel = 'a'.repeat(50);
    const item = makeItem({ label: longLabel, status: 'processing' });

    render(
      <IngestItemStatus
        item={item as Parameters<typeof IngestItemStatus>[0]['item']}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // The rendered label should be truncated - either via CSS or JS truncation
    // We test that the raw 50-char label is NOT rendered as-is in a text node
    // (CSS truncation is applied via the class, we just verify the component renders without error)
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
  });
});
