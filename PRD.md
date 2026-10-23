# StudyMate Product Requirements Document

**Version:** 1.0  
**Status:** Student project MVP  
**Product:** StudyMate — Personal Study Planner

## 1. Summary

StudyMate helps students organize their weekly class timetable, plan study tasks, and spend focused time working toward their goals. Users create accounts so their schedules and tasks are saved in MongoDB and associated with the correct account.

## 2. Problem

Students may keep their classes and study work in separate places. A browser-only planner saves data on one device and does not separate data among users. StudyMate brings the timetable, tasks, and focus timer into one account-based web application.

## 3. Goals and success criteria

- A student can register, sign in, and sign out.
- A student can add, view, and delete classes and study tasks.
- A student can mark tasks complete and view a summary on the dashboard.
- A student can upload a timetable image, review and correct extracted rows, and choose which rows to save.
- A student's data is saved between sessions and cannot be read or changed by another account.
- A student can set a task reminder and run a focus timer.
- The application can be deployed as a public HTTPS Node.js website backed by a hosted MongoDB database.

## 4. Target users

Students who want a lightweight way to organize class times and personal study tasks.

## 5. User stories

- As a student, I want to create an account so my planner belongs to me.
- As a student, I want to enter my weekly classes so I can see my schedule in one place.
- As a student, I want to upload a timetable image and review recognized details so I can avoid manually entering every class.
- As a student, I want to add and complete tasks so I can track my study progress.
- As a student, I want reminders and a focus timer so I can make time for planned work.
- As a student, I want my information separated from other students' information.

## 6. Functional requirements

### Accounts

- Register using name, email, and a password of at least eight characters.
- Sign in and sign out using a server-managed session cookie.
- Store only a password hash; never store the original password.

### Timetable

- Create a class with subject, weekday, start time, end time, and optional room.
- Reject invalid time ranges and overlapping classes on the same day.
- Display classes by weekday and allow deletion.
- Accept an image upload in the browser, perform best-effort OCR, and present editable draft fields.
- Save only rows the student confirms.

### Tasks and reminders

- Create a task with an optional due date and reminder time.
- Mark a task complete or pending and delete it.
- Show task totals on the dashboard.
- Ask permission before using browser notifications.

### Focus

- Provide a configurable countdown timer and a personal list of distractions to avoid.
- Explain how to use built-in operating-system focus controls.

### Data privacy

- Associate each class and task with its owner account on the server.
- Derive ownership from the authenticated session, not from a user ID supplied by the browser.
- Return only records owned by the signed-in user.

## 7. Non-functional requirements

- Use responsive layouts for desktop and mobile browsers.
- Serve the application over HTTPS in production.
- Keep database credentials and session secrets in host environment variables.
- Use MongoDB for application data and persisted sessions in production.
- Provide understandable error feedback for invalid input and failed requests.

## 8. Technology architecture

- **Frontend:** HTML, CSS, browser JavaScript; separate dashboard, login, signup, timetable, tasks, reminders, and focus pages.
- **Application server:** Node.js and Express REST endpoints.
- **Database:** MongoDB with Mongoose models for users and planner entries.
- **Authentication:** bcrypt password hashes and Express sessions stored in MongoDB.
- **Timetable OCR:** Tesseract.js in the browser; extracted text is an untrusted draft until reviewed.

## 9. Out of scope and constraints

- The website cannot block installed apps, device settings, or other websites.
- In this MVP, browser reminders run while the page remains open; the browser may suppress notifications or timers.
- OCR is not guaranteed to recognize every timetable format. Manual review is required.
- Password reset, social sign-in, roles for teachers, native mobile apps, and guaranteed background push alarms are future work.

## 10. Future improvements

- Add a proper marketing/landing page and onboarding flow.
- Add background push notifications through a service worker and push service.
- Add recurring timetable-to-task templates and calendar export.
- Improve OCR with image cropping, grid mapping, and user-confirmed schedule parsing.
- Add rate limiting, email verification, password reset, and automated backup guidance before production use.
