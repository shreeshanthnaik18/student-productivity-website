# StudyMate

A multi-page study planner built with HTML, CSS, browser JavaScript, Node.js, Express, and PostgreSQL.

## Pages and features

- Sign up and sign in with password hashes and server-side sessions.
- Dashboard with weekly class and task summaries.
- Weekly timetable with manual class entry, overlap checking, and deletion.
- Timetable image OCR that creates an editable draft for review before saving.
- Tasks with due dates, completion, deletion, and browser notification reminders.
- Focus timer and a distraction list with device Focus / Digital Wellbeing setup guidance.
- Per-account ownership checks for every saved planner entry.

## Run locally

Requires Node.js 20+ and PostgreSQL. Create a database on Neon or run PostgreSQL locally.

1. Create a PostgreSQL project on Neon. Copy `.env.example` to `.env` and set `DATABASE_URL` to Neon's connection string and choose a long random `SESSION_SECRET`.
2. Install packages with `npm install`.
3. Start the app with `npm run dev` for development or `npm start` normally.
4. Open `http://localhost:3000`.

The server serves the separate HTML pages from `public/` and exposes JSON endpoints under `/api`.

## Deploy globally

The app is a standard Node web service and can be hosted on Render, Railway, Fly.io, or another Node host. A Render Blueprint is included in `render.yaml`: create a PostgreSQL project on Neon, connect the GitHub repository in Render, and provide Neon's pooled `DATABASE_URL` when prompted. Render generates `SESSION_SECRET` and `NODE_ENV` is set to production. The service uses the host-provided `PORT` and serves on its public HTTPS URL. Never commit `.env` or paste database credentials into frontend files. Render's free web services sleep after 15 minutes of inactivity, so the first visit after idle time can be slow. See [Render Blueprint documentation](https://render.com/docs/blueprint-spec) and [Neon documentation](https://neon.com/docs/introduction).

## Product scope notes

OCR is best-effort and should always be checked by the user. Browser notifications in this version are scheduled by the open page, so the page must remain open and the browser must grant permission. A web page cannot block installed apps or other websites; users can use their device's built-in Focus or Digital Wellbeing controls. Reliable background alarms and system-wide app blocking require a native app or a separate push-notification service.

See [PRD.md](PRD.md) for the project requirements document.
