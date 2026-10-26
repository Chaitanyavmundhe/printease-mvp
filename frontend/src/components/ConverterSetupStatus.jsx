import { Download, RotateCw, X } from 'lucide-react';

export default function ConverterSetupStatus({ session, onSetup, onCancel }) {
  const busy = Boolean(session?.converterSetupBusy);
  const ready = session?.converterStatus === 'ready';
  const downloaded = Number(session?.converterDownloadedBytes) || 0;
  const total = Number(session?.converterTotalBytes) || 0;
  const downloading = session?.converterStatus === 'downloading';
  const percent = total ? Math.min(100, Math.floor(downloaded / total * 100)) : null;
  if (!session?.converterSetupSupported) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <p role="status" aria-live="polite" className="break-words text-sm text-slate-700">
        {session.converterMessage || (ready ? 'LibreOffice is ready.' : 'LibreOffice setup pending.')}
      </p>
      {busy && (
        <div className="space-y-1">
          <progress aria-label="LibreOffice setup progress" className="h-2 w-full accent-emerald-600" max="100" value={downloading && percent !== null ? percent : undefined} />
          {downloading && percent !== null && <p className="text-xs text-slate-600">{percent}% · {Math.floor(downloaded / 1048576)} / {Math.ceil(total / 1048576)} MB</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!ready && !busy && (
          <button type="button" onClick={onSetup} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            {session.converterStatus === 'missing' ? <Download size={16} /> : <RotateCw size={16} />}
            {session.converterStatus === 'missing' ? 'Set up LibreOffice' : 'Retry setup'}
          </button>
        )}
        {busy && session.converterSetupCanCancel && (
          <button type="button" onClick={onCancel} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            <X size={16} />Cancel download
          </button>
        )}
        {!ready && session.converterDownloadUrl && (
          <a href={session.converterDownloadUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 px-2 text-sm font-medium text-emerald-800 underline">
            <Download size={16} />Manual download
          </a>
        )}
      </div>
    </div>
  );
}
