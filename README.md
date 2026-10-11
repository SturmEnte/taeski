# Täski

A personal task workspace built with React, Express, and PostgreSQL.

## Requirements

- Node.js 24
- PostgreSQL

## Database

Create a PostgreSQL database, then apply the schema from the repository root:

```sh
psql -d your_database -f DB.sql
```

The schema file also adds the task priority and recurrence columns to an existing `tasks` table.

## Backend

Create `backend/.env` with the connection details for your database and a private JWT secret:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
JWT_SECRET=replace-with-a-long-random-secret
SALT_ROUNDS=10
```

Then run the API:

```sh
cd backend
npm install
npm start
```

Authentication endpoints are `POST /auth/signup` and `POST /auth/login`. Task endpoints require the returned JWT as the `Authorization` header value. Each task is scoped to its owner.

## Web app

In a second terminal:

```sh
cd web
npm install
npm run dev
```

Open the Vite URL printed in the terminal. The development server forwards `/api` requests to the backend on port `3000`.

Tasks support start and end dates, four priority levels, completion, and daily, weekly, monthly, or yearly recurrence. Completing a repeating task creates its next occurrence. The web app includes Today, Upcoming, All tasks, Completed, and Calendar views.