# Security

## What is implemented

- **Server-side token storage.** The Facebook access token lives only in the server session. It is never returned to the browser, stored in browser storage, or sent in a URL.
- **Session cookies** are `httpOnly`, `secure` in production, and regenerated on login to prevent session fixation.
- **OAuth `state` check** on the Facebook Login callback to block cross-site request forgery.
- **Per-request API clients.** Each request uses its own Graph API client, so concurrent users never share a token.
- **Helmet** security headers, **CORS** limited to `FRONTEND_URL`, and **rate limiting** (300 requests per 15 minutes per IP).
- **Input validation** on campaign creation, status changes and budget changes.
- **Error logging without secrets.** Raw SDK errors (which include the token in the request URL) are not logged.
- **Page access tokens** are not requested or exposed.

## Not yet implemented (needed before giving access to clients)

- **User accounts.** Anyone who can reach the app can connect their own Facebook token, but there is no login of its own, no roles, and no per-client restriction of ad accounts.
- **Persistent session store.** Sessions are in memory; use Redis or a database in production.
- **Audit log** of who changed which campaign and budget.
- **CSRF tokens** for state-changing requests if the frontend and backend are served from different sites with `COOKIE_SAMESITE=none`.
- **appsecret_proof** on Graph API calls.

## Production checklist

- Serve both frontend and backend over HTTPS
- Set `NODE_ENV=production`, a strong `SESSION_SECRET`, and correct `FRONTEND_URL` / `BACKEND_URL`
- Keep `.env` out of version control (already in `.gitignore`)
- Run `npm audit` and update dependencies regularly
