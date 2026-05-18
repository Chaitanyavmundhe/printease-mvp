# PrintEase Desktop Architecture

PrintEase uses one shared React frontend for both the web app and the desktop app.

## Deployments

- `frontend/` is the existing Vite React frontend and is deployed to Vercel.
- `backend/` is the existing Express backend and is deployed only to Render.
- `desktop-shell/` is the Electron wrapper installed on a hub PC.

## Backend Rule

The desktop app must never bundle, import, spawn, or run `backend/`.

The desktop app and shared frontend must call the deployed Render backend:

```txt
https://printease-backend-byex.onrender.com
```

The desktop health check uses the API health endpoint:

```txt
https://printease-backend-byex.onrender.com/api/health
```

No backend secrets belong in `frontend/` or `desktop-shell/`, including:

- `DATABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `AGENT_TOKEN_SECRET`

## Desktop Shell

During development, Electron loads the existing frontend dev server:

```txt
http://localhost:5173
```

For a later production build, Electron is prepared to load:

```txt
../frontend/dist/index.html
```

No installer or `.exe` packaging is part of this phase.

## Secure Bridge

The renderer only sees:

```js
window.printeaseDesktop
```

The preload bridge exposes only safe methods:

- `getDesktopStatus`
- `checkBackendHealth`
- `listPrinters`
- `testPrint`
- `stopPrinting`

It does not expose `ipcRenderer`, `fs`, `path`, `child_process`, or backend secrets.

## Printer Support

Linux printer support uses CUPS through `execFile` with `shell: false`:

- `lpstat -p`
- `lpstat -d`
- `lp -d PRINTER_NAME TEMP_FILE`

Printer names are validated against detected local printers before test printing. The CUPS-PDF printer named `PDF` is treated as a real OS printer.

Windows printer support is intentionally a safe placeholder in this phase. It does not fake success.

## Agent Runtime

`desktop-shell/agent/` talks only to the deployed Render API:

- `/api/agent/pair/start`
- `/api/agent/pair/confirm`
- `/api/agent/heartbeat`
- `/api/agent/printers`
- `/api/agent/jobs/next`
- `/api/agent/jobs/:jobId/*`

Pairing stores the agent token in main-process memory only. It is not exposed to the renderer and is not written to disk.

Print job processing downloads backend-signed files into a temporary directory, verifies SHA-256 when the backend provides a hash, sends the file to the selected local printer, reports job status back to Render, then removes the temporary file.

Job polling starts only when the hub user clicks the desktop control. It does not start automatically when the Electron shell opens.
