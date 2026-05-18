# PrintEase Desktop Next Steps

- Add UI for device pairing and runtime token handoff.
- Start heartbeat/printer sync only after a hub explicitly pairs this desktop.
- Start job polling only after a hub explicitly enables local desktop printing.
- Add a resume button for local paused printing.
- Test Windows printer support on a real Windows machine.
- Package the desktop app as an installer when the packaging phase begins.

Still intentionally not in this phase:

- No `.exe` installer.
- No `electron-builder`.
- No local database.
- No mock backend or fake order data.
- No frontend API base URL change away from Render.
