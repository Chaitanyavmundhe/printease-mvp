import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import HubDesktopDownload from '../HubDesktopDownload';
import { downloadLatestDesktopInstaller } from '../../services/desktopDownloads';

vi.mock('../../services/desktopDownloads', () => ({ detectDesktopPlatform: () => 'windows', downloadLatestDesktopInstaller: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('hub web desktop download', () => {
  it('is visible only for a web hub account', () => {
    const { rerender } = render(<HubDesktopDownload role="user" desktopAvailable={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<HubDesktopDownload role="hub" desktopAvailable />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<HubDesktopDownload role="hub" desktopAvailable={false} />);
    expect(screen.getByRole('button', { name: 'Download Desktop App' })).toBeTruthy();
  });
  it('downloads the matching platform on click without fetching on mount', async () => {
    downloadLatestDesktopInstaller.mockResolvedValue();
    render(<HubDesktopDownload role="hub" desktopAvailable={false} platform="windows" />);
    expect(downloadLatestDesktopInstaller).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download Desktop App' }));
    await waitFor(() => expect(downloadLatestDesktopInstaller).toHaveBeenCalledWith('windows'));
  });
  it('offers an explicit OS choice on mobile instead of downloading Linux for Android', async () => {
    render(<HubDesktopDownload role="hub" desktopAvailable={false} platform={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Desktop App' }));
    fireEvent.click(screen.getByRole('button', { name: 'Windows EXE' }));
    await waitFor(() => expect(downloadLatestDesktopInstaller).toHaveBeenCalledWith('windows'));
  });
  it('offers a prominent Windows button while retaining desktop and user guards', async () => {
    const { rerender } = render(<HubDesktopDownload role="hub" desktopAvailable={false} platform="windows" variant="button" label="Download Windows App" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Windows App' }));
    await waitFor(() => expect(downloadLatestDesktopInstaller).toHaveBeenCalledWith('windows'));
    rerender(<HubDesktopDownload role="hub" desktopAvailable platform="windows" variant="button" label="Download Windows App" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
