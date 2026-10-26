# LibreOffice First-Launch Setup

Updated October 27, 2026 for PrintEase Desktop 0.1.114.

## Scope

Windows x64 first-launch setup only. LibreOffice remains outside the PrintEase
installer and Git repository. There are no backend, Supabase, payment, print
dispatch, early-download, pairing or agent-token changes. Linux continues to
use its existing converter installation; both platforms now require a successful
version probe and real PDF conversion before reporting ready.

## Linear Flow

1. main.js creates the main window, then starts checkConverterAtStartup without
   awaiting setup. Only a packaged Windows x64 app starts automatic setup.
2. desktopConverterService.js owns native status/IPC reporting independently of
   agent pairing, login, heartbeat and print polling.
3. windowsConverterSetup.js checks existing configured/system/PATH candidates.
   Working installations are reused. A broken installation is reported as
   repair_required, not automatically replaced or downgraded.
4. An exclusive process lock and persisted windows-setup.json prevent concurrent
   downloads and repeated automatic attempts after failure or interruption.
5. windowsInstallerDownload.js reads the packaged, pinned installer JSON. It
   accepts only the expected GitHub release URL and HTTPS GitHub asset redirects.
   A 20-minute timeout, exact size bound, SHA-256, free-space check and AbortSignal
   protect the streamed download. Progress reflects received bytes only.
6. windowsMsiInstaller.js independently checks size/hash and Windows Authenticode
   with the Document Foundation publisher. It starts Windows Installer, requesting
   normal UAC elevation if the current process is not administrator.
7. The elevated process holds a read-only/shared-read handle, rechecks integrity
   and signature, and waits for MSI completion. It cannot accept renderer-chosen
   URLs, commands, flags or executable paths. No forced reboot or Office file
   association takeover is requested.
8. Only exit code zero followed by a successful version command and a non-empty
   PDF parsed by pdf-lib permits ready. Reboot-required, busy, cancelled, signature
   failures and other installer errors have explicit non-ready outcomes.
9. Temporary installer data is deleted after the attempt; abandoned setup folders
   are cleaned under the setup lock before an explicit retry. A still-running
   installer can retain Windows file locks; its work is not forcibly terminated.

## Corrected False Ready Detection

The old detector accepted result.success OR any output containing LibreOffice.
That matched spawn libreoffice ENOENT and also ignored failed smoke conversions.
The new probe requires successful execution AND a LibreOffice version string AND
an actual valid PDF. Bare PATH soffice.com/soffice.exe commands are executed as
commands, not mistakenly checked as files in the current directory. Actual
Program Files environment paths are considered, including non-C Windows drives.

ConversionPage no longer infers readiness from converterPath. A stale path cannot
hide a missing engine. Diagnostic results update the shared agent session instead
of being a disconnected JSON report.

## First Attempt, Retry And Cancel

The attempt record lives in the converter root beside converter.json, normally
%LOCALAPPDATA%/PrintEase/converter/windows-setup.json. Do not delete these files
to force unattended repeat installations. Use Retry setup in Conversion
Diagnostics. Cancellation can abort checking, download or verification, but not
an already elevated Windows installation. Windows may still ask for administrator
credentials. Refusal is cancellation, never ready.

The installer is approximately 373 MB and setup requires at least 3 GB free.
Network restrictions, unsupported operating systems/architectures, enterprise
policy, corrupt existing installs and MSI errors can still prevent setup.
Windows Installer 3010/1641 requires restart; 1618 means another install is busy.
Automatic attempts do not resume endlessly across launches. A regular manual
download link remains available.

A normal first launch checks without blocking the window. It does not require a
hub login or agent token and does not approve payment or start printing. App update
installation is deferred while setup is active so it cannot interrupt this work.
Dev-mode/Linux startup never automatically downloads the Windows dependency.

## Trusted Source

The MSI and its official checksum were mirrored without modification under:

https://github.com/adityasomde/printease-desk/releases/tag/converter-libreoffice-26.2.6-win-x64

The local config/libreoffice-windows-installer.json is authoritative. The older
JSON attached to that dependency release is an initial source-only snapshot,
not a downloaded executable policy. Future source/hash changes require another
code review and Windows conversion test. Keep third-party licenses and the exact
corresponding source links in LIBREOFFICE_GITHUB_DOWNLOAD_SOURCE.md.

## Verification

- Node tests cover false ENOENT, failed smoke tests, hash/signature rejection,
  exact size/redirect guards, shell quoting, elevation integrity checks, duplicate
  attempts, cancellation, retry persistence, MSI outcomes and print safety.
- Frontend tests cover real progress, indeterminate install state, retry and cancel.
- .github/workflows/converter-checks.yml runs on Linux and Windows. The disposable
  Windows VM downloads the actual MSI, verifies its signature, installs it and
  runs real conversion with a path containing spaces and an apostrophe.
- That native test intentionally forces its first detection missing even if the
  CI image already has LibreOffice. This override is test code, not a runtime
  environment bypass. Running it outside Windows Actions is refused.
- Package verification requires Windows setup modules/config and rejects any
  bundled MSI, soffice binary or vendor/libreoffice payload on either platform.
- Both frontend builds, Linux packaging and the isolated PDF viewer/launch smoke
  test are checked before tagging. Windows/Linux release assets are built by CI.

The administrator-capable CI VM cannot test a human UAC click or every supported
Windows version. Physical printers, production payments and unrelated enterprise
security policies remain manual checks. No complete security guarantee is implied.

## Web Hub Installer Download

The profile menu offers Download Desktop App only to signed-in hub accounts on
the website. It is hidden for ordinary users, logged-out visitors and inside
the desktop shell. A click resolves GitHub's latest stable application release,
selects its Windows EXE or Linux x86_64 AppImage and starts the asset download.
Unsupported/mobile OS detection offers an explicit Windows/Linux choice rather
than mistaking Android for Linux desktop. No backend/user/agent token is sent to
GitHub, no release version is hardcoded, and dependency/prerelease/foreign-host
assets are rejected. Failed lookup shows an error and permits retry.

Native Windows setup passed on the disposable runner:
https://github.com/adityasomde/printease-desk/actions/runs/40401244099

The Linux hub Activity and Hub History PDF preview paths also pass the packaged
canvas/worker smoke test. An installed 0.1.112 process was found still running
with the old external worker and no bundled worker: restarting the new app is
required to use 0.1.113-or-newer preview code. Do not close an active print agent
or interrupt physical printing merely to apply a UI update.
