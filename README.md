# EduFlow LMS

EduFlow is a role-based learning management system built with Express, a static browser UI, and LowDB JSON storage.

## Features

- JWT sign-in with administrator, instructor, and student roles
- Secure first-administrator setup; no public demo accounts or seeded sample records
- Administrators create instructors and courses, publish courses, and manage accounts
- Instructors manage lessons, add students to their active courses, create assignments, and grade submissions
- Students browse and enroll in active courses, read lessons, track completion, submit assignments, and view feedback
- Analytics based on saved accounts, enrollments, lesson progress, and graded submissions
- Lecture materials: PDFs, Office documents, images, audio, video, text, and ZIP uploads with authorization
- Assignment instructions, passing marks, secure student file submissions, resubmission, and automatic grades
- Student/instructor profile updates, profile photos, and current-password-required password changes
- Internal notifications and course/admin announcements
- Configurable default grading scale stored in the LowDB schema

## Requirements

- Node.js 18 or newer
- npm

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `JWT_SECRET` to a random value of at least 32 characters and configure the first administrator:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`. The initial administrator password must contain at least 12 characters. Keep `.env` private; it is excluded from Git.

3. Create the first administrator:

   ```sh
   npm run create-admin
   ```

   This command only works while there are no accounts and never resets or overwrites existing data. To initialize another clean local database, set `EDUFLOW_DB_FILE` to a new private file path before running it.

4. Start the server:

   ```sh
   npm start
   ```

Open <http://localhost:5000> and sign in with the administrator account you configured. Admins create instructor accounts; admins and instructors can create students. Instructors must enroll students in at least one of their active courses. Students may also self-enroll in active courses.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port (defaults to `5000`) |
| `JWT_SECRET` | Yes | Signing secret; use a random value of at least 32 characters |
| `JWT_EXPIRE` | No | JWT lifetime (defaults to `7d`) |
| `CORS_ORIGIN` | No | Comma-separated allowlist of origins for external API clients |
| `EDUFLOW_DB_FILE` | No | Private JSON database path (defaults to `data/db.json`) |
| `ADMIN_NAME` | First setup | Name for the initial administrator |
| `ADMIN_EMAIL` | First setup | Email for the initial administrator |
| `ADMIN_PASSWORD` | First setup | Initial administrator password (at least 12 characters) |

Set production values through the hosting provider's secret/environment settings. Keep `.env` and the database file private; both are excluded from Git.

## Checks

```sh
npm test
npm run check
```

GitHub Actions runs these checks on pushes and pull requests.

## Deployment notes

LowDB uses a local JSON file and is suitable only for development or a small single-instance deployment with persistent storage. Concurrent and multi-instance writes are not supported. Use a transactional database before scaling or storing production learning records. Configure HTTPS, a strong `JWT_SECRET`, persistent backups, and hosting secrets before publishing. Revenue, time-on-platform, and rating analytics are not available because billing, time tracking, and review features are not implemented.

Choose and add a license before allowing others to reuse this project.
