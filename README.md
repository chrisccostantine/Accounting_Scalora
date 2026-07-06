# Scalora Accounting System

Production-ready internal accounting web app for Scalora, split into a React frontend and an Express/PostgreSQL backend.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Axios, Recharts
- Backend: Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, bcrypt, Helmet, CORS, rate limiting, Winston
- Deployment: Railway-ready Dockerfiles for separate frontend and backend services

## Project Structure

```text
frontend/
backend/
railway.json
```

## Local Setup

Install dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Create a PostgreSQL database, then copy environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend environment:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=4000
CLIENT_URL="http://localhost:5173"
ADMIN_EMAIL="admin@scalora.local"
ADMIN_PASSWORD="change-this-password"
```

Frontend environment:

```env
VITE_API_URL="http://localhost:4000/api"
```

Run migrations and seed the single admin user:

```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

Start locally:

```bash
cd backend
npm run dev

cd ../frontend
npm run dev
```

Open `http://localhost:5173` and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Railway Deployment

Create one Railway project with PostgreSQL plus two services.

Backend service:

- Root directory: `backend`
- Dockerfile: `backend/Dockerfile`
- Variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL`
- The Docker command runs `prisma migrate deploy` automatically before starting the API.
- After first deploy, run `npm run db:seed` once from a Railway shell or locally against the Railway `DATABASE_URL`.

Frontend service:

- Root directory: `frontend`
- Dockerfile: `frontend/Dockerfile`
- Build argument / variable: `VITE_API_URL=https://your-backend.up.railway.app/api`

Set `CLIENT_URL` on the backend to the deployed frontend URL so CORS allows browser requests.

## Features

- Single-admin JWT login with hashed password and token expiration
- Protected dashboard, clients, income, expenses, and reports pages
- CRUD for clients, income, and expenses
- Search, filters-ready API, pagination-ready responses
- Monthly income, expenses, profit, active clients, collected income, pending payments
- Recharts dashboards and report charts
- Backend validation with Zod and frontend validation with React Hook Form + Zod
- Consistent API response format:

```json
{ "success": true, "message": "...", "data": {} }
```

```json
{ "success": false, "message": "...", "errors": [] }
```

## Production Notes

- Use a long random `JWT_SECRET`.
- Change `ADMIN_PASSWORD` immediately after seeding by reseeding with a new value or updating the user password hash.
- Keep frontend and backend as separate Railway services.
- PostgreSQL access is handled through Prisma parameterized queries.
