const RELEASE_API = 'https://api.github.com/repos/adityasomde/printease-desk/releases/latest';

export function detectDesktopPlatform(userAgent = navigator.userAgent) {
  if (/windows|win32|win64/i.test(userAgent)) return 'windows';
  if (/linux/i.test(userAgent) && !/android/i.test(userAgent)) return 'linux';
  return null;
}

export async function getLatestDesktopInstaller(platform, { fetchImpl = fetch } = {}) {
  if (!['windows', 'linux'].includes(platform)) throw new Error('Choose Windows or Linux.');
  // This is a public GitHub request, not the backend API: never send user/agent
  // tokens. Resolve on click, not at build time or from the dependency release.
  const response = await fetchImpl(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Could not check the latest desktop release. Please retry.');
  const release = await response.json();
  const match = /^(?:desktop-)?v(\d+\.\d+\.\d+)$/.exec(release.tag_name || '');
  if (!match || release.draft || release.prerelease) throw new Error('A stable desktop release is not available.');
  const version = match[1];
  const name = platform === 'windows'
    ? `PrintEase-Desktop-Setup-${version}.exe`
    : `PrintEase-Desktop-${version}-x86_64.AppImage`;
  const expected = `https://github.com/adityasomde/printease-desk/releases/download/${release.tag_name}/${name}`;
  const asset = release.assets?.find(item => item.name === name && item.browser_download_url === expected && item.size > 0);
  if (!asset) throw new Error('The latest release does not have that installer yet. Please retry shortly.');
  return { url: expected, version, name };
}

export async function downloadLatestDesktopInstaller(platform) {
  const asset = await getLatestDesktopInstaller(platform);
  window.location.assign(asset.url);
}
