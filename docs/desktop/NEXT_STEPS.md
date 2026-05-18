# PrintEase Desktop Next Steps

1. Register desktop device with the Render backend.
2. Add heartbeat after explicit hub pairing.
3. Sync detected printers to the backend.
4. Fetch print jobs assigned to this desktop.
5. Download signed PDF files from backend-provided URLs.
6. Verify downloaded PDF SHA-256 hashes.
7. Print actual order PDFs.
8. Report job status back to Render.
9. Implement Windows printer support.
10. Package an `.exe` later.

Still intentionally not in this phase:

- No `.exe` installer.
- No `electron-builder`.
- No SQLite or local database.
- No mock orders.
- No fake printer success.
- No backend bundling inside Electron.
