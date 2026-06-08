# PrintEase Deployment And Frontend Sync Diagnosis

Date: 2026-06-08

## Problem

Frontend changes are visible locally, but they are not showing on the public website or not consistently showing in the desktop app.

Public website:

```txt
https://printhubdesi.vercel.app/
```

## Current Diagnosis

The latest MVP changes are on this branch:

```txt
feature/fix-guest-print-limit
```

The production branch is likely:

```txt
main
```

Local check showed `main` is behind the feature branch. The feature branch contains many frontend/backend/doc changes that are not in `main`, including loginless print flow, history settings, cleanup/security fixes, and the new vulnerability report.

That means Vercel can keep deploying an older build even though local code looks correct.

## Why Local Works But Website Does Not

Local development uses files from:

```txt
printease-mvp-main/frontend/src
```

Production Vercel usually builds from the GitHub production branch configured in Vercel, commonly `main`.

If latest changes are only pushed to:

```txt
feature/fix-guest-print-limit
```

but Vercel production deploys:

```txt
main
```

then the public site will not update.

## Evidence

Current MVP branch:

```txt
feature/fix-guest-print-limit
```

Latest local commits include:

```txt
69f9ebb feat: updated cleanup logic and added print config to history tracking
0088802 fix: address security vulnerabilities and add mitigations
c85b215 fix: guest print limits, local history, and db imports
0ca069c feat: loginless upload, 15-day cleanup, and local history
0769373 Fix optional auth for loginless printing
```

Current local `main` is older:

```txt
c42c1e2 feat: Implement guest/unlogged-in printing limitations with strict offline-only payment and 5-page max
```

The feature branch has many changes not in `main`.

## Desktop Sync Diagnosis

The shared frontend sync script says MVP frontend and desktop frontend differ:

```txt
Changed/different important files:
  DIFF: src/
```

This means the desktop frontend is not perfectly synced with the latest MVP frontend source.

The correct script exists:

```bash
./sync-shared-frontend.sh mvp-to-desk --apply --build-desk
```

Use it only when MVP frontend is confirmed to be the source of truth.

Do not use the old destructive sync unless absolutely needed:

```txt
printease-desk/sync-frontend-from-mvp.sh
```

The safer script is:

```txt
printease-desk/sync-shared-frontend.sh
```

## Correct Web Release Process

Use this when MVP feature branch is ready for production:

```bash
cd "/home/adisssss/Desktop/web_dev/printhub/printease-mvp-main"
git checkout main
git pull origin main
git merge feature/fix-guest-print-limit
npm run build --prefix frontend
npm test --prefix frontend
npm test --prefix backend
git push origin main
```

Then in Vercel:

1. Confirm project is connected to the same GitHub repo.
2. Confirm production branch is `main`.
3. Redeploy production.
4. If stale, redeploy without build cache.

## Correct Backend Release Process

If backend files changed, Render must deploy the same branch/commit that contains those backend changes.

For this project, backend changes exist in:

```txt
feature/fix-guest-print-limit
```

If Render deploys `main`, merge the branch into `main` and push.

Then check Render logs for startup and schema errors.

## Correct Desktop Sync/Release Process

After MVP web changes are final and merged/pushed:

```bash
cd "/home/adisssss/Desktop/web_dev/printhub/printease-mvp-main"
./sync-shared-frontend.sh mvp-to-desk --apply --build-desk
```

Then in desktop repo:

```bash
cd "/home/adisssss/Desktop/web_dev/printhub/printease-desk"
npm run verify:package --prefix desktop-shell
git status --short
```

Only create a desktop release tag after the desktop app is intentionally ready.

## Things Not To Confuse

Vercel does not deploy `frontend-dist`.

Vercel deploys the web frontend source:

```txt
printease-mvp-main/frontend
```

Electron desktop uses:

```txt
printease-desk/frontend-dist
```

So rebuilding `frontend-dist` fixes the desktop app, but it does not update the public website.

## Most Likely Root Cause

The public website is stale because production deployment is not using the branch containing the newest frontend/backend changes.

Most likely:

```txt
latest changes: feature/fix-guest-print-limit
Vercel production: main
Render backend: main
```

## Quick Verification Checklist

Run locally:

```bash
cd "/home/adisssss/Desktop/web_dev/printhub/printease-mvp-main"
git branch --show-current
git log --oneline --decorate -5
git log --oneline main..feature/fix-guest-print-limit
```

If commits appear in `main..feature/fix-guest-print-limit`, production `main` does not have those changes.

Check Vercel:

- Project production branch
- Latest deployment commit SHA
- Whether latest deployment SHA equals the commit you expect

Check Render:

- Deploy branch
- Latest deployment commit SHA
- Backend logs for schema mismatch or CORS blocked messages

## Safe Rule Going Forward

For web production:

```txt
merge to main -> push main -> Vercel/Render redeploy
```

For desktop:

```txt
sync MVP frontend to desktop -> rebuild frontend-dist -> verify desktop package -> tag desktop release
```

Do not assume a local build, feature branch push, or desktop `frontend-dist` rebuild updates the public website.
