# Application Desk

Application Desk is a self-hosted MERN dashboard for organizing a personal job search. Capture opportunities from job boards, communities, and referrals; track applications and replies; and draft personalized emails from reusable templates.

Repository: [VandanPatell/ApplicationDesk](https://github.com/VandanPatell/ApplicationDesk)

## Features

- Job records with company, role, description, technology tags, contacts, posting URL, source, salary, and notes.
- Read-only application details, with separate editing and direct navigation to Email studio.
- Saved, Applied, Interview, Offer, Rejected, and Withdrawn stages; reply flags and follow-up dates.
- Remote, Hybrid, and On-site arrangements, with city/location details.
- Dashboard statistics, application pipeline, search, and stage/reply filters.
- Excel `.xlsx` import with a downloadable template, preview, row validation, duplicate checks, and selected-row import.
- Six editable starter email templates, shared candidate variables, portfolio/resume links, and editable drafts.
- Optional Gmail OAuth connection, reviewed sending, attachments, and send history.
- Reusable attachment library and JSON export of jobs, templates, and variables.

This is a single-user application without login/authentication. The default installation is available only on your own computer. Do not expose it publicly without adding authentication and HTTPS.

## Stack and services

| Service | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 19, Vite, Nginx | Dashboard and `/api` reverse proxy |
| Backend | Node.js 22, Express, Mongoose | Application API, Excel import, Gmail integration |
| Database | MongoDB 7 | Applications, templates, variables, attachment bytes, encrypted OAuth tokens, and history |

Only Nginx is published, at `127.0.0.1:8080`. The backend and MongoDB communicate over the private Docker Compose network and have no published host ports.

## Install with Docker

### Requirements

- Git, to clone the repository.
- Docker Desktop with Compose v2 on Windows/macOS, or Docker Engine with the Compose plugin on Linux.
- On Windows, use Docker Desktop's **Linux containers** backend, normally with WSL 2.
- An available local port **8080**.

You do not need Node.js, npm, or MongoDB installed on the host for the Docker installation. Gmail configuration is optional; job tracking, templates, Excel import, and attachments work without it.

### 1. Clone the repository

```sh
git clone https://github.com/VandanPatell/ApplicationDesk.git
cd ApplicationDesk
```

### 2. Create the local configuration

For a fresh clone, copy the example file. Keep an existing `.env` when upgrading.

Linux/macOS:

```sh
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The defaults work immediately. Leave the Google credentials blank unless you want to connect Gmail. Never commit your real `.env`.

### 3. Build and start

Start Docker Desktop/the Docker engine, then run:

```sh
docker compose up --build -d
```

The first run downloads images, installs dependencies inside the build containers, and creates the database files. Check readiness:

```sh
docker compose ps
docker compose logs --tail=50 backend
```

MongoDB should be healthy and the backend should report `Application Desk API ready`.

### 4. Open your workspace

Open [http://localhost:8080](http://localhost:8080).

1. Open **My variables** and enter your own name, email, experience, skills, portfolio URL, and resume URL. Fresh installs contain no candidate's personal details or applications.
2. Review **Email studio** starter templates and tailor their wording to your experience. Fill variables referenced by your templates, or remove optional signature fields you do not use. Portfolio and resume links are retained automatically.
3. Add an application or use **Import Excel** to download and fill the workbook template.
4. Upload your own resume or supporting files to the attachment library as needed.

Existing installations keep their saved templates, personal variables, and applications when upgraded. Starter templates are initialized once.

## Configuration

Docker Compose reads the project-root `.env`.

| Variable | Default / required value | Purpose |
| --- | --- | --- |
| `APP_ORIGIN` | `http://localhost:8080` | Browser origin and base URL for the Google callback |
| `GOOGLE_CLIENT_ID` | Blank; optional | Your Google Web application OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Blank; optional | Your Google OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | Blank; required for Gmail | A private, random 64-character hexadecimal key |

The backend's `MONGO_URI` and `PORT` are set by Compose to use the internal MongoDB service and port 4000. Changing `APP_ORIGIN` does not change the published port; any custom port also requires changing the frontend `ports` entry in `compose.yaml` and the registered Google callback.

### Optional Gmail connection

Follow the full [Gmail setup guide](docs/GMAIL_SETUP.md). In brief:

1. Enable Gmail API in your own Google Cloud project and configure OAuth consent/test users.
2. Create a **Web application** OAuth client with the exact redirect URI `http://localhost:8080/api/gmail/callback`.
3. Put its client ID and client secret in `.env`.
4. Generate an encryption key using the running backend container; host Node.js is not required:

   ```sh
   docker compose exec backend node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Copy the generated key to `TOKEN_ENCRYPTION_KEY` in `.env`, keep it private, and apply the configuration:

   ```sh
   docker compose up -d
   ```

6. Open **Email studio**, select **Connect Gmail**, and complete Google sign-in/consent yourself.

The integration requests send-only Gmail access plus Google email identity. It does not request inbox-reading access. Connecting does not send an email. Every send requires draft review and confirmation.

## Daily use

### Track applications

Click a company or its View icon to read the full application. Use **Edit application** to make changes. The row's **Email** action, or **Open in Email studio** in the details modal, preselects the application and fills its contact/company/role fields. Quick status and reply controls remain available in the tracker.

Hybrid and On-site records require a city. Remote records may include a region or location restriction. Follow-ups due today or overdue appear on Overview.

### Import from Excel

1. Select **Import Excel**, then **Download Excel template**.
2. Enter jobs below row 1 on the **Applications** sheet. The **Guide** sheet explains the columns and contains examples that are not imported.
3. Company name and Job title are required. Hybrid/On-site roles also require a city. Use Excel dates or `YYYY-MM-DD`; missing dates stay blank. Separate technology tags with commas or semicolons. Paste formula results as values before importing.
4. Choose the `.xlsx`, preview it, inspect errors/duplicates and **View fields**, then select the Ready rows to save.
5. Select **Import selected rows**. Previewing alone does not add applications, and existing applications are never overwritten.

Limits: **1,000 jobs and 5 MB per file**. Use row 1 for headers and keep data within the first 10,000 rows. The importer selects Applications, or the first worksheet if that sheet is absent. Common column aliases are accepted; unknown columns are reported and ignored. Save older `.xls` or CSV files as standard `.xlsx` first. Password-protected and macro-enabled workbooks are unsupported.

Duplicates match a normalized posting URL (ignoring tracking parameters/fragments), or company + role + city + work arrangement. Checks run during preview and again during import. Previews expire after 30 minutes. Repeating a completed request returns its original result. If interrupted, refresh the tracker and re-upload; saved rows are detected as duplicates.

### Draft emails and attach files

Shared variables use double braces: `{{candidate-name}}`, `{{candidate-email}}`, `{{skills}}`, `{{portfolio-url}}`, and `{{resume-url}}`, for example. The selected application supplies `{{company-name}}`, `{{job-title}}`, `{{company-email}}`, and `{{job-url}}`. Missing placeholders remain visible and block sending.

Upload/select up to **5 attachments**, with **10 MB per file and 18 MB combined**, then use Gmail's **Review & send**. You can optionally record an application date and move Saved to Applied after Gmail accepts the email. Other stages are preserved. History records the result; it is not a delivery receipt.

**Mail app (no files)** uses a standard `mailto:` link, which cannot carry attachments. Its handoff screen offers downloads for manual attachment. Copying a draft also excludes files. A timeout or uncertain Gmail result must be checked in Gmail Sent before starting a new send; the dashboard does not retry automatically.

## Data storage and backups

MongoDB storage is bind-mounted **inside this project**:

```text
data/mongo/          Database files, attachments, and encrypted OAuth records
data/mongo-config/   MongoDB configuration directory
```

The database, `.env`, private outputs/screenshots, and backups are excluded from Git. A clone starts a separate personal workspace, not a copy of another user's data. Stopping containers does not delete these directories.

**Export backup** downloads JSON with jobs, templates, and variables. It excludes attachment bytes, OAuth credentials, and send history, and JSON restore is not implemented yet. For a full database backup, with services running:

```sh
mkdir backups
docker compose exec -T mongo mongodump --db=application-desk --archive=/tmp/application-desk.archive
docker compose cp mongo:/tmp/application-desk.archive ./backups/application-desk.archive
```

Protect backups and your `.env` separately. The encryption key is needed to use backed-up Gmail credentials. A database archive can be restored to a fresh/empty workspace with `mongorestore`. Alternatively, stop the services before copying both MongoDB data directories; do not copy live database files.

## Manage or update the installation

```sh
# Show logs; Ctrl+C exits log viewing without stopping services
docker compose logs -f

# Stop/remove containers and the Compose network, preserving bind-mounted data
docker compose down

# Start again
docker compose up -d

# Upgrade source and rebuild while retaining data and .env
git pull --ff-only
docker compose up --build -d
```

Do not delete `data/mongo` or `data/mongo-config` unless you intend to erase that workspace's database files. Changing or losing `TOKEN_ENCRYPTION_KEY` requires reconnecting Gmail.

## Development without Docker

Install Node.js 22+ and run a local MongoDB instance. Then:

```sh
npm --prefix backend ci
npm --prefix frontend ci
```

Start the API in one terminal:

```sh
npm --prefix backend run dev
```

Start Vite in another:

```sh
npm --prefix frontend run dev
```

The API defaults to `mongodb://127.0.0.1:27017/application-desk` and port 4000. Vite forwards `/api` to port 4000. Set backend process environment variables to override these defaults; native Node does not automatically load `.env`. For native Gmail development, use the Vite origin for `APP_ORIGIN` and register that exact Google callback too.

## Tests and verification

With local npm dependencies installed:

```sh
npm test
npm run build
```

The tests cover job/date validation, template links, email MIME/attachments, authorization guards, Excel parsing, and duplicate detection. With Docker services running:

```sh
# Temporary job/template records in the current workspace, removed after checking
node scripts/smoke.mjs

# Isolated temporary databases; deleted after completion
docker compose exec -T backend node integration/mail.mjs
docker compose exec -T backend node integration/job-import.mjs
docker compose exec -T backend node integration/bootstrap.mjs
```

The mail integration test mocks Google and never sends real email. Actual Gmail OAuth and delivery require your own configured account. The bootstrap check verifies fresh-install defaults and preservation of existing workspaces. The smoke script requires host Node.js; the isolated checks run inside the container.

Optional local resume import (also requires host Node.js):

```sh
node scripts/import-resume.mjs "/absolute/path/to/your-resume.pdf"
```

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Cannot connect to Docker | Start Docker Desktop/engine; confirm Linux containers and `docker compose version`. |
| Port 8080 is already in use | Stop the conflicting service, or update Compose's frontend port and `APP_ORIGIN`; adjust Google callback if used. |
| Dashboard reports API unavailable | Inspect `docker compose ps` and `docker compose logs backend mongo`; wait for MongoDB health/startup. |
| Database permission errors on Linux | Ensure the bind-mounted data directories are writable by the MongoDB container user; avoid broad permissions such as `chmod 777`. |
| Changes are not visible | Rebuild with `docker compose up --build -d`, then reload the browser. |
| Gmail cannot connect or send | Follow [Gmail setup and troubleshooting](docs/GMAIL_SETUP.md), including exact callback URL, test-user access, Gmail API enablement, key, and account limits. |
| Excel file rejected | Save standard `.xlsx`, use the provided headers, paste formulas as values, and check file/row limits. |

## Project layout

```text
backend/src/                 Express API, models, imports, email, and defaults
backend/assets/              Downloadable Excel template
backend/test/                Unit/API tests
backend/integration/         Disposable-database integration checks and fixtures
frontend/src/                React UI and styling
frontend/nginx.conf          Frontend hosting and API reverse proxy
scripts/                     Optional local verification/resume helpers
docs/GMAIL_SETUP.md           Google OAuth and sending setup
compose.yaml                 Frontend, backend, and MongoDB services
.env.example                 Safe configuration example
TODO.md                      Planned features
```

## License

[MIT](LICENSE). Copyright (c) 2026 Vandan Sojitra.
