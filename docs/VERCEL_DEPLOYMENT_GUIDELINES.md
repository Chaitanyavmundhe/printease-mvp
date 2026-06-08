# Vercel Deployment Guidelines

This document exists because production has repeatedly looked stale even after local fixes worked. The usual cause is that the latest code was pushed to a feature branch, while Vercel production deploys from `main`.

## Production Source

Vercel production should deploy the MVP web frontend from:

```text
Repository: Chaitanyavmundhe/printease-mvp
Branch: main
Root directory: frontend
Build command: npm run build
Output directory: dist
```

If any of these settings differ in Vercel, production may not reflect the code you just pushed.

## Before Expecting Production To Update

Run these checks from:

```bash
cd "/home/adisssss/Desktop/web_dev/printhub/printease-mvp-main"
```

Check current branch:

```bash
git branch --show-current
```

Production changes must be on:

```text
main
```

Check local status:

```bash
git status --short
```

This should be empty before pushing a production update.

Check the latest commit:

```bash
git log -1 --oneline
```

Check that `main` has the latest feature commit:

```bash
git log --oneline origin/main..HEAD
```

If this shows commits while on `main`, push them:

```bash
git push origin main
```

If your latest work is on a feature branch, fast-forward `main` only when safe:

```bash
git checkout main
git merge --ff-only feature/fix-guest-print-limit
git push origin main
```

Do not force push production branches.

## Build Locally Before Production Push

For frontend-only changes:

```bash
npm run build --prefix frontend
```

For backend changes:

```bash
npm test --prefix backend
```

For auth, payment, upload, order, or database-related changes, run both.

## Vercel Dashboard Checks

After pushing `main`, open the Vercel project and verify:

```text
1. A new production deployment started.
2. The deployment commit hash matches git log -1 --oneline on main.
3. The deployment root directory is frontend.
4. The deployment finished successfully.
5. The public URL is not showing an old preview deployment.
```

If no new deployment starts, Vercel is probably connected to a different branch, repo, or project.

## Common Mistakes

### Pushing Only A Feature Branch

Problem:

```bash
git push origin feature/fix-guest-print-limit
```

This does not update production if Vercel deploys `main`.

Fix:

```bash
git checkout main
git merge --ff-only feature/fix-guest-print-limit
git push origin main
```

### Checking A Preview URL Instead Of Production

Vercel creates preview deployments for branches. Always check the configured production domain:

```text
https://printhubdesi.vercel.app/
```

### Wrong Root Directory

The MVP repository contains multiple folders. Vercel must build the web app from:

```text
frontend/
```

If root directory is the repository root, Vercel may miss the frontend build configuration.

### Desktop Build Confusion

Desktop uses:

```text
printease-desk/frontend-dist
```

Vercel does not deploy `frontend-dist`. Rebuilding desktop does not update the website.

### Backend Not Redeployed

Frontend can deploy successfully while backend changes are still old on Render. For backend/API changes:

```text
1. Push backend code to the branch Render deploys.
2. Confirm Render redeployed successfully.
3. Confirm frontend points to the correct Render backend URL.
```

## Supabase Is Separate

Database schema changes do not happen just because Vercel deployed. If a feature needs new columns or indexes, run the documented SQL in Supabase first or immediately after backend deployment.

For loginless print/order features, check:

```text
documents.page_count
documents.storage_path
documents.file_sha256
print_orders.customer_type
print_orders.expires_at
print_orders.guest_token
print_orders.price_snapshot
print_orders.print_config_snapshot
print_order_files table
```

## Production Release Checklist

Use this checklist every time:

```text
1. Confirm the change is on main.
2. Confirm git status is clean.
3. Run frontend build if frontend changed.
4. Run backend tests if backend changed.
5. Push origin main.
6. Check Vercel deployment commit hash.
7. Check Render deployment if backend changed.
8. Run required Supabase SQL if schema changed.
9. Hard refresh production site or test in private window.
10. Confirm the exact user flow that was fixed.
```

## Quick Diagnosis Commands

```bash
git branch --show-current
git status --short
git log -1 --oneline
git log --oneline origin/main..HEAD
git remote -v
npm run build --prefix frontend
npm test --prefix backend
```

## Rule For Future Agents

Never say "production is updated" unless:

```text
1. The production branch was pushed.
2. The hosting provider started a deployment for that commit.
3. The public production URL was checked after deployment.
```

