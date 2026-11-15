# EduFlow LMS

EduFlow is a lightweight learning management system demo with a responsive admin dashboard and a JSON-backed Express API.

## Features

- JWT-based sign-in
- Course, instructor, student, and assignment management
- Separate admin, instructor, and student workspaces with role-based access
- Admin-provisioned instructor accounts and admin/instructor-provisioned student accounts
- Student course discovery and enrollment; instructor course and assignment views
- Dashboard and enrollment analytics
- Responsive dashboard UI

## Requirements

- Node.js 18 or newer
- npm

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `JWT_SECRET` to a random value of at least 32 characters. For example:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Create the demo data and account:

   ```sh
   npm run seed
   ```

4. Start the server:

   ```sh
   npm start
   ```

Open <http://localhost:5000>. Demo sign-in: `admin@eduflow.io` / `Admin123!`.

`npm run seed` replaces the contents of the local database. Do not run it against production data. The demo credentials are public by design and must never be used for a deployed instance.

Admins add instructors from **Instructors** and choose the instructor's initial password. Admins and instructors can add student accounts from **Students**. Instructors must enroll each student in at least one of their active courses; admins may do so optionally. Share those initial passwords securely; users can then sign in at the same login page and are shown the workspace allowed by their account role. Students can also enroll themselves in active courses.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port (defaults to `5000`) |
| `JWT_SECRET` | Yes | Signing secret; must be at least 32 characters in production |
| `JWT_EXPIRE` | No | JWT lifetime (defaults to `7d`) |
| `CORS_ORIGIN` | No | Comma-separated allowlist of origins for external API clients. Leave unset for same-origin use. |
| `EDUFLOW_DB_FILE` | No | Database JSON file path; defaults to `data/db.json` |

Set production values through the hosting provider's secret/environment settings. Keep `.env` and `data/db.json` private; both are excluded from Git.

## Checks

```sh
npm test
npm run check
```

GitHub Actions runs these checks on pushes and pull requests.

## Deployment notes

This project uses LowDB and a local JSON file for demonstration and small single-instance deployments. The data file must be on persistent storage, and concurrent/multi-instance writes are not supported. Use a transactional database before deploying at scale or storing production learning records. Configure HTTPS and a strong `JWT_SECRET`; do not seed a public production instance.

Before making a public repository, choose and add a license that matches how you want others to use this project.
