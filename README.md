# AITU Academic Habit & Task Tracker

A simple web application for Astana IT University students. A student can add study tasks by subject, mark them as done with one click, and see progress charts and a streak of days.

**Course project:** ICT, group SE-2623 (Final Project)

- **Public link:** https://1ndra1.github.io/aitu-tracker2/
- **Repository:** https://github.com/1ndra1/Aitu-Tracker-project

## Problem

Many students start the term with high motivation, but after a few weeks they lose their study routine. In our survey of 8 students, 87.5% stopped tracking their habits in 1–2 weeks, and 75% said they could not see clear progress. Our site is a fast and simple tool that shows the tasks and the progress in one place.

## Features

- Registration and login (email and password)
- Add a task with a title, subject, hour and minutes
- Mark a task as done with one click (no page reload)
- Delete a task
- Streak of days in a row (Profile tab)
- Progress chart by day, week, month and year, and a chart by subject
- Calendar with the number of tasks for each day
- Weekly schedule
- Reminders
- Filter by subject and sorting of tasks
- Pomodoro timer
- Dark and light theme
- Works on laptop and phone (from 375 px width)
- "How it works" block with a help video

## Technologies

| Part | Technology |
| --- | --- |
| Frontend | HTML, CSS, JavaScript |
| Charts | Chart.js |
| Login | Firebase Authentication |
| Database | Cloud Firestore (NoSQL) |
| Hosting | GitHub Pages |
| Tools | VS Code, GitHub, draw.io |

## How to run

**Option 1. Open online (easiest).**
Open https://1ndra1.github.io/aitu-tracker2/ in Chrome, Edge or Safari.

**Option 2. Run locally.**
1. Download the repository (Code > Download ZIP) or clone it:
   ```
   git clone https://github.com/1ndra1/Aitu-Tracker-project.git
   ```
2. Open the folder and open `index.html` in Chrome.
3. The internet is needed, because the site connects to Firebase.

## Test account

The system has one user role: **student**.

| Role | Email | Password |
| --- | --- | --- |
| Student | `TEST_EMAIL` | `TEST_PASSWORD` |

You can also create your own account with the "Registration" button.

## How to test

1. Open the site and log in (or register).
2. Add a task (write to the database).
3. Tick the task: the text is crossed out and a message appears.
4. Refresh the page (F5): the task is still there (read from the database).
5. Open the Profile tab: statistics, streak and progress chart.

## Database

Cloud Firestore has three collections:

| Collection | Fields |
| --- | --- |
| `users` | user_id, name, email, createdAt |
| `subjects` | subject_id, subject_name, color_code |
| `tasks` | task_id, user_id, subject_id, title, date, time, done, createdAt, completedAt |

One student has many tasks, and one subject has many tasks (3NF).

## Security

- All connections use HTTPS.
- Passwords are handled only by Firebase Authentication. We do not store them.
- Firestore Security Rules: a student can read and write only his own user document and his own tasks. Subjects can be read, but they cannot be changed from the website.
- We store only name and email. We do not store the phone number.

## Architecture

Browser (laptop or phone) → GitHub Pages (static files) → Firebase Authentication (login) → Cloud Firestore (data, protected by Security Rules).
The IoT idea (ESP32 + RFID desk reader) is only a design. It is not built.

## Team

| Member | Role |
| --- | --- |
| Zhenis Alibek | Software Architect and Lead Developer |
| Kambarov Amirkhoja | Lead, Business Analyst and Security Officer |
| Yerkin Adilzhan | UI/UX Designer and Database Architect |

## Known limitations

- Only the student role exists (no mentor view).
- Data for the analysis is generated test data (100 records).
- The IoT extension is a design only.

## Future work

- Mentor view
- Search of tasks
- Hosting the database in a region in Kazakhstan, if the university needs it
- Build and test the IoT desk sensor
