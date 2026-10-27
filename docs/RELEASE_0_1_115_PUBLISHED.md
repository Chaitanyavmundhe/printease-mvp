# PrintEase Desktop 0.1.115: Publication Record

Published 2026-10-27 as stable/latest, not a draft.

- Public release: https://github.com/adityasomde/printease-desktop-releases/releases/tag/v0.1.115
- Public tag: v0.1.115. Private source tag: desktop-v0.1.115.
- Source build commit: 5407668f9e0b81e7503fb4baf3432280ff4e1b9e.
- Native build workflow: https://github.com/adityasomde/printease-desk/actions/runs/40429881466
- Converter checks: https://github.com/adityasomde/printease-desk/actions/runs/40429541376

Windows and Linux builds/package scans passed. Windows packaging proved SumatraPDF
and its notice were inside resources. The native Windows LibreOffice download,
installation and real PDF conversion smoke test passed. LibreOffice is not bundled.

All seven expected assets were copied from the private CI release, with installer
SHA-512 checked against update metadata before public publication. Windows EXE,
Linux AppImage, Debian package and the public updater Atom feed returned HTTP 200
without credentials. latest.yml and latest-linux.yml both identify 0.1.115.

Local checks: backend 137 tests, web 120, desktop frontend 88, desktop runtime 44;
Linux package build/launch and PDF previews passed. Real hardware printing and
end-user Windows installation were not tested on this workstation.

## Rollout Still Required

Vercel reported successful deployment, and the production website bundle contains
manual-request checkout without gateway/demo endpoints.

The live Render backend STILL returned the old gateway-enabled payment config at
the final check. Pushing source did not prove backend rollout. Redeploy latest
main of Chaitanyavmundhe/printease-mvp on Render, inspect migration/startup logs,
then verify /api/payments/config returns methods=["manual"] and
onlinePaymentsEnabled=false. Do not claim online payment endpoints are disabled
in production until this is checked. No Render settings or live DB were changed
manually by this release task.

Older apps pointing at the private repository require a one-time manual install
from the public release. Later updates use the public feed. Source stays private;
no GitHub token is embedded in installers. Both source repositories were pushed.
