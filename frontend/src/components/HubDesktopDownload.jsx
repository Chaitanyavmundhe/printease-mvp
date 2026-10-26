import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { detectDesktopPlatform, downloadLatestDesktopInstaller } from '../services/desktopDownloads';

export default function HubDesktopDownload({ role, desktopAvailable, platform = detectDesktopPlatform() }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choosePlatform, setChoosePlatform] = useState(false);
  if (role !== 'hub' || desktopAvailable) return null;

  async function download(target) {
    if (!target) { setChoosePlatform(true); return; }
    setBusy(true); setError('');
    try { await downloadLatestDesktopInstaller(target); }
    catch (failure) { setError(failure.message || 'Download could not start. Please retry.'); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <button type="button" disabled={busy} onClick={() => download(platform)} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-60">
        {busy ? <Loader2 size={16} className="shrink-0 animate-spin" /> : <Download size={16} className="shrink-0" />}
        {busy ? 'Finding latest installer...' : 'Download Desktop App'}
      </button>
      {choosePlatform && <div className="flex flex-wrap gap-2 px-3 py-2">
        {['windows', 'linux'].map(target => <button key={target} type="button" disabled={busy} onClick={() => download(target)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold"><Download size={14} />{target === 'windows' ? 'Windows EXE' : 'Linux AppImage'}</button>)}
      </div>}
      {error && <p role="alert" className="break-words px-3 py-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
