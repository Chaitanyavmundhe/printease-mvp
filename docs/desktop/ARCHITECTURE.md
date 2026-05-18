# PrintEase Desktop Architecture

PrintEase uses one shared React frontend for both the web app and the desktop app.

## Runtime Split

- `frontend/` is the real PrintEase React app and is deployed to Vercel.
- `backend/` is the real backend source and is deployed to Render.
- `desktop-shell/` is the Electron wrapper for desktop-only capabilities and is packaged separately.
- Printer code lives only inside `desktop-shell/printer/`.
- Agent placeholders live inside `desktop-shell/agent/` and do not poll automatically yet.

## Backend Rule

The frontend backend URL remains:

```txt
https://printease-backend-byex.onrender.com
```

Do not point the frontend to localhost for this desktop phase. Do not place Supabase service keys in the frontend or desktop shell.

The desktop app must never bundle, import, spawn, or run `backend/`. It only calls the deployed Render API:

```txt
https://printease-backend-byex.onrender.com
```

When the shared frontend is running inside Electron, `frontend/src/services/api.js` ignores `VITE_API_URL` and uses the Render URL. The Electron agent modules also use the Render URL directly and do not accept arbitrary backend URL overrides.

`desktop-shell/package.json` uses a narrow `files` allowlist so future package steps include only the shell files, not `frontend/` source or `backend/`.

## Desktop Bridge

The renderer only sees a safe preload bridge:

```js
window.printeaseDesktop
```

The frontend calls desktop features through `frontend/src/utils/desktopBridge.js`. It does not import Node modules, Electron APIs, file system APIs, child processes, or printer code.

## Electron Shell

During development, Electron loads:

```txt
http://localhost:5173
```

For a later production build, Electron loads:

```txt
../frontend/dist/index.html
```

IPC handlers in `desktop-shell/main.js` route desktop requests to the safe printer executor. Printer commands use `execFile` with `shell: false`.

## Printer Support

Linux uses CUPS commands:

- `lpstat -p`
- `lpstat -d`
- `lp`
- `cancel`

The CUPS-PDF printer named `PDF` is treated as a real OS printer.

Windows uses PowerShell printer cmdlets:

- `Get-CimInstance Win32_Printer`
- `Out-Printer`
- `Get-PrintJob`
- `Remove-PrintJob`

The renderer never executes these commands directly. It only calls the preload bridge, and the main process validates printer names against the current OS printer list before printing.

## Agent Runtime

The desktop agent modules are wired to the existing Render backend agent endpoints, but they do not start automatically:

- pairing: `/api/agents/pair/start` and `/api/agents/pair/confirm`
- heartbeat: `/api/agents/heartbeat`
- printer sync: `/api/agents/printers`
- job polling: `/api/agents/jobs/next`
- job status updates: `/api/agents/jobs/:jobId/*`

Downloaded print files are stored in a temporary directory, checked against SHA-256 when the backend provides a hash, printed locally, and then removed. Agent tokens are accepted as runtime parameters and are not persisted by `local/config.js`.
