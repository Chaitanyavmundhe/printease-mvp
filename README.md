# PrintEase / PrintHubDesi

Production deployment uses:

- Frontend: React + Vite on Vercel
- Backend: Node.js + Express on Render
- Database: Supabase PostgreSQL

## Production Environment

Vercel frontend:

```text
VITE_API_URL=https://printease-backend-byex.onrender.com
```

Recommended: do not include `/api` at the end of `VITE_API_URL`. The frontend URL joiner also handles a base URL that already ends in `/api`.

Render backend:

```text
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://printhubdesi.vercel.app
JWT_SECRET=<strong-secret>
DATABASE_URL=<supabase-postgres-url>
PGSSLMODE=require
```

Never commit real `.env` files. Keep only `.env.example` files in git.

## CORS Origins

The backend keeps `credentials: true` and does not use a wildcard origin. It allows:

- `FRONTEND_URL` from Render, normally `https://printhubdesi.vercel.app`
- `https://printhubdesi.vercel.app`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- HTTPS Vercel preview origins ending in `.vercel.app` whose hostname includes `printease`, `printhubdesi`, or `printease-mvp`

This lets production, Vercel previews, local Vite, and the Electron dev shell call the same Render backend without allowing random websites.

## Health Checks

Backend health endpoint:

```text
https://printease-backend-byex.onrender.com/api/health
```

The deployed frontend should call:

```text
https://printease-backend-byex.onrender.com/api/health
```

## Troubleshooting

### Deployed frontend tries localhost

Cause:

- `VITE_API_URL` is missing on Vercel.
- Old hardcoded localhost code is still in the frontend.
- Vercel served an old cached build.

Fix:

- Run `grep -R "localhost" frontend/src`.
- Set `VITE_API_URL=https://printease-backend-byex.onrender.com` in Vercel.
- Redeploy the Vercel frontend without build cache.

### Backend health works directly but frontend fails

Cause:

- CORS is blocking the Vercel origin.
- The frontend is using an old URL.
- Mixed content or wrong environment variables.

Fix:

- Check the browser Network tab.
- Check Render logs for `[CORS BLOCKED]`.
- Set `FRONTEND_URL=https://printhubdesi.vercel.app` on Render.
- Vercel previews and local Vite at `http://localhost:5173` are allowed by backend code; no backend URL should point to localhost.

### CORS verification commands

```bash
curl -i https://printease-backend-byex.onrender.com/api/health

curl -i \
  -H "Origin: https://printhubdesi.vercel.app" \
  https://printease-backend-byex.onrender.com/api/health

curl -i \
  -H "Origin: http://localhost:5173" \
  https://printease-backend-byex.onrender.com/api/health

curl -i \
  -H "Origin: https://YOUR-VERCEL-PREVIEW-URL.vercel.app" \
  https://printease-backend-byex.onrender.com/api/health
```

Allowed origin checks should return `Access-Control-Allow-Origin` matching the request origin.

### `/api/api/health` issue

Cause:

- Older frontend code may double-prefix endpoints if `VITE_API_URL` includes `/api` and endpoint paths also start with `/api`.

Fix:

- Keep the current `joinApiUrl` helper in `frontend/src/services/api.js`, or set `VITE_API_URL=https://printease-backend-byex.onrender.com`.

### JWT secret issue

Cause:

- `JWT_SECRET` is missing on Render or differs from the token-signing environment.

Fix:

- Set a strong `JWT_SECRET` on Render.
- Recreate local backend `.env` values when needed.

### Database URL issue

Cause:

- The Supabase password contains special characters such as `@`.
- The password is not URL-encoded.

Fix:

- Encode `@` as `%40`.
- Set `PGSSLMODE=require` on Render, or use a Supabase connection string that includes `sslmode=require`.
- Rotate the database password if it was exposed.

## Commit And Redeploy

```bash
git add .
git commit -m "Fix production API connection and error handling"
git push
```

Then redeploy:

- Render backend if backend files changed.
- Vercel frontend if frontend files changed.
- Use a Vercel redeploy without build cache after changing environment variables.
