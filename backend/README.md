# PrintEase Backend

Backend API starter for PrintEase, a QR based smart printing platform.

## Tech Stack

- Node.js
- Express.js
- JWT authentication
- Multer for file upload placeholder
- PostgreSQL with `pg`
- Render-ready deployment setup
- Designed for future Supabase + Razorpay integration

## Install

```bash
npm install
```

## PostgreSQL setup

Create a local PostgreSQL role for your Linux user once, then create the project database.

```bash
sudo service postgresql start
sudo -u postgres createuser --superuser "$USER"
createdb printease
cp .env.example .env
npm run db:setup
```

If the role already exists, `createuser` may say so; that is fine. If your local PostgreSQL uses the `postgres` role/password instead, use `createdb -U postgres printease` and set `PGUSER`/`PGPASSWORD` or `DATABASE_URL` in `.env`.

The seed data uses this demo password for both seeded accounts:

```text
Password@123
```

## Run locally

```bash
npm run dev
```

Backend starts on:

```text
http://localhost:5000
```

Health check:

```text
GET /api/health
```

## Render deployment settings

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

## Database Files

- `src/db/schema.sql` creates the tables.
- `src/db/seed.sql` loads demo centres, users, printers, and one order.
- `src/db/setup.js` applies schema and seed through `npm run db:setup`.

## Main API Groups

- `/api/auth`
- `/api/centres`
- `/api/printers`
- `/api/orders`
- `/api/payments`
- `/api/uploads`

## Security Rule

Never trust frontend payment status. In production, payment should be verified by backend using Razorpay signature/webhook.
