# Connect your Gmail account

The dashboard uses Google's server-side OAuth flow, the Gmail API, and the `gmail.send` scope. It also requests OpenID/email identity to show the connected sender. It does not request inbox-reading permissions or your Gmail password.

## One-time Google configuration

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select your own project.
2. Enable **Gmail API** under APIs & Services.
3. Configure **Google Auth Platform / OAuth consent** with an app name and support email. For personal testing, choose External where appropriate and add your Gmail address under test users. A Workspace account may be subject to administrator restrictions.
4. Add scopes `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send` in Data Access.
5. Create an OAuth client with type **Web application**. Add this exact authorized redirect URI:

   ```text
   http://localhost:8080/api/gmail/callback
   ```

6. Copy `.env.example` to a project-root `.env` if it does not exist, then put your client ID and client secret there. Keep real credentials out of chat, frontend code, and Git.

   ```dotenv
   APP_ORIGIN=http://localhost:8080
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   TOKEN_ENCRYPTION_KEY=64-hex-characters
   ```

   Generate the key with `docker compose exec backend node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` after starting the services. This requires no host Node.js installation. Put the generated value in `.env` and keep it private. Preserve any existing key; changing or losing it requires reconnecting Gmail.

7. Run `docker compose up -d` from this project directory to apply the environment variables.
8. Open [the dashboard](http://localhost:8080), choose **Email studio**, and select **Connect Gmail**. Complete Google's sign-in and consent yourself. You return to the dashboard with the connected email displayed.

For native development, set these variables in the backend environment and set `APP_ORIGIN=http://localhost:5173` (or your Vite port). Register that exact callback URL in Google as well. `.env` is read by Docker Compose; the native Node server does not automatically load it.

## Draft, attach, and send

1. Enter your own candidate values and URLs in **My variables**, then choose a template and application. Fresh installs contain reusable generic templates and blank profile values. Existing personal values and custom templates are preserved; later edits/deletions are respected on restart.
2. Edit **To**, **Subject**, and **Email body**. Job-specific placeholders require an application or manual replacement.
3. Upload your own resume or supporting files, then select attachments from the local library. Limits are 5 attachments, 10 MB per file, and 18 MB combined. Uploading does not send anything to Google.
4. Choose whether to update the application date/status after sending. Existing Interview/Offer/etc. stages are preserved; only Saved moves to Applied.
5. Click **Review & send**, check the sender, recipient, full email, and file names, acknowledge the review, then click **Send email now**.

The dashboard records Gmail's accepted send result, recipient, subject, sender, attachment names, and timestamp. This is not a delivery receipt. Copy/mail-app alternatives do not include attachments automatically.

The **Mail app (no files)** button opens a handoff screen. Download any selected files there and attach them manually in your email client, then continue to the prefilled email. The portfolio and public resume links are included in every template, so the resume remains accessible even without a file attachment. Standard `mailto:` URLs do not support MIME attachments; see [RFC 6068](https://www.rfc-editor.org/rfc/rfc6068.html). Only the dashboard's connected Gmail send includes selected file bytes automatically.

## Connection and storage

- OAuth access/refresh tokens are encrypted using AES-256-GCM in MongoDB; the key and Google client secret stay in the backend environment.
- Attachments are stored as binary data in MongoDB, so they persist under this project's existing bind-mounted database directory. JSON exports omit attachments, OAuth tokens, and send history; use a database backup to preserve attachments/history. Keep `.env` separately protected if backing up the database.
- Connection requests use state, browser-bound HttpOnly cookies, and PKCE. Sensitive changes require a same-origin custom request header. Sending uses a unique request identifier to prevent retrying the same message twice.
- A timeout, lost connection, or Gmail server error may leave the send result uncertain. Check Gmail **Sent** before initiating a new send. The dashboard never retries a send automatically.
- Disconnect revokes authorization where possible and removes the locally stored tokens. If Google cannot be reached, remove the app from your [Google account connections](https://myaccount.google.com/connections) too.
- Google OAuth apps in External Testing can have refresh-token expiration after seven days for scopes beyond basic identity, requiring reconnection. Google/Workspace policies, verification, quotas, and sending limits apply.
- This remains a localhost, single-user application. Add real authentication before any network exposure, especially now that the server can send mail.

## Troubleshooting

- **Setup required:** check the client ID, secret, and 64-character hex encryption key in `.env`, then recreate the backend with `docker compose up -d`.
- **redirect_uri_mismatch:** use the exact registered callback URI, scheme, hostname, and port. Use `localhost`, not `127.0.0.1`, with the default configuration.
- **Access blocked:** verify test-user membership, Gmail API enablement, consent configuration, and any Workspace administrator restrictions.
- **Connection failed:** confirm all requested permissions were granted and try Connect again. OAuth states expire after 10 minutes or a backend restart.
- **Authorization expired:** reconnect Gmail and review consent. No email is sent by connecting alone.
- **Gmail rejected the email:** confirm Gmail API enablement, permissions, account limits, recipient, and attachment sizes. Reopen review to create a new send only after checking the result.

References: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail send scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [MIME and attachment sending](https://developers.google.com/workspace/gmail/api/guides/sending).
