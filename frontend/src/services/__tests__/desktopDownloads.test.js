import { describe, it, expect, vi } from 'vitest';
import { getLatestDesktopInstaller, detectDesktopPlatform } from '../desktopDownloads';

const tag = 'desktop-v0.1.999';
function fixture() { return { tag_name: tag, draft: false, prerelease: false, assets: [
  { name: 'PrintEase-Desktop-Setup-0.1.999.exe', size: 123, browser_download_url: 'https://github.com/adityasomde/printease-desktop-releases/releases/download/' + tag + '/PrintEase-Desktop-Setup-0.1.999.exe' },
  { name: 'PrintEase-Desktop-0.1.999-x86_64.AppImage', size: 123, browser_download_url: 'https://github.com/adityasomde/printease-desktop-releases/releases/download/' + tag + '/PrintEase-Desktop-0.1.999-x86_64.AppImage' },
] }; }
describe('latest desktop asset resolution', () => {
  it('uses the latest tag, not a hardcoded application version', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture())));
    expect((await getLatestDesktopInstaller('windows', { fetchImpl })).name).toBe('PrintEase-Desktop-Setup-0.1.999.exe');
    expect((await getLatestDesktopInstaller('linux', { fetchImpl })).name).toBe('PrintEase-Desktop-0.1.999-x86_64.AppImage');
    expect(fetchImpl.mock.calls[0][1].credentials).toBe('omit');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it('rejects dependency/prerelease assets and foreign download hosts', async () => {
    for (const change of [
      data => { data.tag_name = 'converter-libreoffice-26.2.6-win-x64'; },
      data => { data.prerelease = true; },
      data => { data.assets[0].browser_download_url = 'https://example.com/setup.exe'; },
    ]) {
      const data = fixture(); change(data);
      await expect(getLatestDesktopInstaller('windows', { fetchImpl: async () => new Response(JSON.stringify(data)) })).rejects.toThrow();
    }
  });
  it('detects desktop OS without treating Android as Linux desktop', () => {
    expect(detectDesktopPlatform('Windows NT 10.0')).toBe('windows');
    expect(detectDesktopPlatform('X11; Linux x86_64')).toBe('linux');
    expect(detectDesktopPlatform('Linux; Android 10')).toBeNull();
  });
  it('explains missing public app releases rather than suggesting a retry or a private fallback', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 404 }));
    await expect(getLatestDesktopInstaller('windows', { fetchImpl })).rejects.toThrow(/No public desktop app release.*administrator must publish/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.github.com/repos/adityasomde/printease-desktop-releases/releases/latest');
  });
  it.each([403, 429])('distinguishes GitHub rate limiting (%s)', async status => {
    const fetchImpl = async () => new Response('{}', { status, headers: { 'x-ratelimit-remaining': '0' } });
    await expect(getLatestDesktopInstaller('windows', { fetchImpl })).rejects.toThrow(/temporarily limited/);
  });
  it('distinguishes a GitHub service failure', async () => {
    await expect(getLatestDesktopInstaller('windows', { fetchImpl: async () => new Response('{}', { status: 503 }) })).rejects.toThrow(/GitHub could not provide release information/);
  });
});
