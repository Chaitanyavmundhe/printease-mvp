import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import ConverterSetupStatus from '../ConverterSetupStatus';

afterEach(cleanup);
describe('Windows converter setup status', () => {
  it('shows real download progress and allows cancellation without retrying concurrently', () => {
    const cancel = vi.fn();
    render(<ConverterSetupStatus session={{ converterSetupSupported: true, converterSetupBusy: true, converterSetupCanCancel: true, converterStatus: 'downloading', converterDownloadedBytes: 50, converterTotalBytes: 100 }} onCancel={cancel} />);
    expect(screen.getByRole('progressbar').value).toBe(50);
    expect(screen.queryByRole('button', { name: /Retry setup/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel download' }));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('shows retry on failure and does not infer ready from a stale path', () => {
    const setup = vi.fn();
    render(<ConverterSetupStatus session={{ converterSetupSupported: true, converterStatus: 'failed', converterPath: 'libreoffice', converterMessage: 'Installation failed' }} onSetup={setup} />);
    expect(screen.getByRole('status').textContent).toBe('Installation failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry setup' }));
    expect(setup).toHaveBeenCalledOnce();
  });
  it('does not offer cancellation during Windows installation or fake a percent', () => {
    render(<ConverterSetupStatus session={{ converterSetupSupported: true, converterSetupBusy: true, converterSetupCanCancel: false, converterStatus: 'installing' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('progressbar').hasAttribute('value')).toBe(false);
  });
});
