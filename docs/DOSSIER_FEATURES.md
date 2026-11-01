# Dossier-inspired Application Desk

This branch extends the existing MERN portal after reviewing [AienTech/Dossier](https://github.com/AienTech/dossier), its README, screenshots, design tokens, and workflow structure. It is an independent implementation in React, Express and MongoDB. Dossier's application source, assets, demo records and AGPL license have not been copied into this repository. The original MIT license is retained.

The checkpoint before this work is `29fae15` on `main`. The new work is on `codex/dossier-inspired-portal`. Existing records and `.env` are preserved; MongoDB schemas are extended without destructive migrations.

## Feature comparison

| Dossier workflow | Application Desk implementation | Setup or difference |
| --- | --- | --- |
| Paper-like shell, serif headings, grouped sidebar, dark mode | Implemented, including collapsible navigation and responsive layouts | Light, dark and system appearance in Settings |
| Dashboard funnel and weekly activity | Implemented with 30-day, 90-day and all-time filters | Uses recorded stages, reply flags and new stage history; old history is not invented |
| Next actions and upcoming interviews | Implemented | Local follow-up dates and calendar events |
| Career profile and strength meter | Implemented | Basics, skills/languages, experience, projects, education, publications, references and section ordering |
| Import a resume | Implemented for PDF, DOCX, Markdown and text | Extracted text is reviewed before saving; scanned PDFs need external OCR; structured sections remain editable |
| Base resume and themes | Implemented with twelve font/color themes, accent controls, live preview, theme import/export and server-generated PDFs | The preview and PDF use different renderers; exact pagination may differ. Current PDF standard fonts target Latin-script documents |
| Tailored resume, cover letter and email | Implemented per application from saved profile facts | Default drafting is deterministic and reorders matching skills; it is not an AI-generated eligibility assessment |
| Fit and gaps | Implemented with transparent keyword overlap | No score if no supported requirements can be identified; not a probability of getting hired |
| AI generation and refinement | Implemented as optional provider adapters | OpenAI-compatible APIs, Ollama, LM Studio, Mistral or Anthropic; configure your own model and credentials. Review every AI claim |
| Document editing, versions and undo | Implemented | Manual edits and AI refinements create versions; restoring creates a new version; latest 50 text revisions retained |
| Application board/table | Implemented | Saved, Applied, Screening, Interview, Offer, Accepted, Rejected, Declined, Withdrawn; legacy stages and Excel import retained |
| Capture from pasted posting | Implemented with local field extraction | Extracts labeled company/role/location, contact, links, arrangement and known technologies; review fields before saving |
| Public job discovery | Implemented: Remotive, Adzuna, JSearch | Remotive requires no key and is cached for six hours; other sources require your own credentials and may impose charges/quotas |
| Startup discovery | Implemented from Hacker News “Who is hiring?” | Current top-level posts, source links, fit and gaps; no YC-specific scraper or employer website crawler |
| Daily search agent | Implemented | Opt in, save a query/source/threshold, and keep the backend running. One search per day in the configured scheduler timezone; results await review. It never applies, sends mail or generates paid AI drafts automatically |
| Gmail sending and PDF attachments | Implemented; existing reviewed send preserved | “Prepare email & PDFs” places the generated resume and cover letter into the attachment library and preselects them in Email studio |
| Gmail inbox and response tracking | Implemented, opt-in | Up to 20 inbox messages from the past 90 days; suggests a job by exact contact-email match. Explicit linking marks replied and adds one timeline note per message. No automatic mailbox-wide AI processing |
| Calendar and interview preparation | Implemented | Local event CRUD, linked applications, preparation notes, meeting links, month/day views and `.ics` download |
| Google Calendar synchronization | Implemented, opt-in and manually triggered | Timed primary-calendar events: import the preceding week and next 90 days (up to 100), upload local upcoming events, latest edit wins. All-day events, deletions, recurring-series management and free/busy suggestions are not synchronized |
| Export, import and scheduled backups | Implemented | Merge-only restore with preview and confirmation; preserves existing IDs. JSON includes attachment bytes but excludes OAuth tokens and API keys. Daily backups in project-local `data/backups` |
| Single-password access | Implemented, optional | Scrypt password hash, signed HttpOnly/SameSite session cookie and login rate limit. Configure before any network exposure; retain HTTPS and firewall protection |
| Claude MCP connector | Not implemented | No Claude account is connected or assumed |
| Automated interview-time suggestions, autonomous reply drafting, multilingual document localization | Not implemented | Local interview planning and manual reply drafting are available |

## Start or upgrade

```sh
git switch codex/dossier-inspired-portal
docker compose up -d --build
```

Open [Application Desk](http://localhost:8080). All existing Gmail, Excel, timeline, deletion-confirmation and application workflows remain available. Save your Profile before creating document drafts. Saving non-empty name/email/skills and portfolio/resume/GitHub values also updates their shared email variables; other variables are preserved.

## Optional AI

Add only your chosen provider's values to the existing project-root `.env`. Do not replace the file or put secrets in source control.

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=your-model
AI_API_KEY=your-private-key
```

For Ollama use `AI_PROVIDER=ollama`, an installed local model name, and `AI_BASE_URL=http://host.docker.internal:11434/v1`. LM Studio and Mistral use the OpenAI-compatible adapter with their respective endpoints. Anthropic uses `AI_PROVIDER=anthropic` and `AI_BASE_URL=https://api.anthropic.com/v1`.

Apply changes with `docker compose up -d`. Generation/refinement takes up to two minutes. Selecting AI sends the saved profile and posting/document text to the configured endpoint. Drafts need factual review; the application does not guarantee that a model cannot hallucinate. No AI requests are made by profile-based drafting, and the daily agent does not spend model credits.

## Optional job sources

Remotive and Hacker News work without keys. Remotive's feed is cached in memory for six hours and query/location matching happens locally. API availability and quotas belong to each provider. A backend restart clears that cache.

For Adzuna configure `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `ADZUNA_COUNTRY` (default `in`). For JSearch configure `JSEARCH_API_KEY`. Apply environment changes with `docker compose up -d`. Search output is saved separately from applications; only **Save** or **Prepare an application** creates an application. Duplicate URL or company/role matches return the existing record.

The agent checks on a five-minute timer while the backend runs. An enabled search runs once per scheduler day (`TZ`, default `Asia/Kolkata`); manual searches remain available. Missed days are not replayed. Failures are recorded for review rather than retried continuously.

## Google integrations

See [Gmail and Calendar setup](GMAIL_SETUP.md). Send-only accounts remain send-only. In **Settings → Gmail & Google Calendar**, explicitly select read access and/or calendar access and reconnect to grant those scopes. Connecting, reading replies, linking a reply or syncing events never sends an email. Use Email studio's existing review-and-confirm flow to send.

## Data protection

- `data/mongo` and `data/mongo-config` remain the only MongoDB bind mounts.
- `data/backups` is the backend's additional project-local backup bind mount. Scheduled backups run only when enabled and the backend is running. There is no automatic deletion/retention policy.
- A JSON backup supports up to 5,000 applications, 10,000 records per other collection, 30 MB of attachment bytes and 45 MB overall JSON. Use the README's MongoDB dump procedure for larger workspaces.
- Restore adds missing records only. Existing applications/documents are not overwritten. Starter-template keys, discovery source IDs, mail request IDs and import row identities are checked as well as record IDs, avoiding conflicts in a fresh installation. Profile/preferences are inserted only if absent; variables are imported only where no candidate name is configured. Retry after a partial restore is safe because record IDs are preserved.
- Backups are plaintext personal data. OAuth tokens and API secrets are excluded; protect `.env` separately. Backups are not encrypted by this feature.
- The default port remains `127.0.0.1:8080`; no backend/database port is published.

To enable the optional password, generate a hash interactively:

```sh
docker compose exec backend node scripts/hash-password.mjs
```

Put the printed values in `.env`. **Single-quote the complete `APP_PASSWORD_HASH` value**, since it contains dollar signs, for example `APP_PASSWORD_HASH='scrypt$...$...'`. Keep `APP_SESSION_SECRET` private and at least 32 characters long. Apply with `docker compose up -d`. Sessions last 12 hours; changing the session secret invalidates them. Use HTTPS before exposing the portal beyond localhost. The app remains single-user.

## Validation

```sh
npm run install:all
npm test
npm run build
docker compose exec -T backend node integration/career.mjs
docker compose exec -T backend node integration/google-career.mjs
docker compose exec -T backend node integration/mail.mjs
docker compose exec -T backend node integration/job-import.mjs
docker compose exec -T backend node integration/bootstrap.mjs
docker compose exec -T backend node integration/timeline.mjs
```

Integration scripts create uniquely named disposable databases and remove them afterwards. Google integration tests use a fake OAuth/HTTP service; no real Google permissions, requests or emails are used. Frontend tests exercise document creation, theme saving, attachment handoff, navigation, appearance and deletion recovery using an in-memory API. Browser QA uses an isolated database for editable preview data and a read-only pass over the user's actual workspace.

## Local dashboard addresses

Normal dashboard actions accept localhost, 127.0.0.1 and IPv6 loopback on the configured scheme and port. Unrelated origins and other ports are rejected. For a custom development port or hosted address, set APP_ORIGIN accordingly. Google sign-in must start at the exact configured APP_ORIGIN so its host-only state cookie returns to the registered callback host.
