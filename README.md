# Facebook Campaign Manager

A web application to create, launch, and manage Facebook (Meta) ad campaigns in one place.

## Features

1. **Create Campaign**: a three-step workflow that builds a campaign, ad set, creative and ad in one go.
   - Campaign: name, objective, campaign-level or ad set-level budget, bid strategy
   - Ad set: countries, age, gender, pixel and conversion event, bid/cost cap, schedule
   - Ad: page, copy, call-to-action, and image or video upload (sent straight to your ad account)
   - Everything is created **paused**. If any step fails, the partly built campaign is deleted automatically.

2. **Reporting**: campaign, ad set or ad level stats (spend, impressions, clicks, CTR, CPC, leads, cost per lead)
   - Pause or activate items
   - Change daily or lifetime budgets, entered in normal currency amounts
   - Amounts are shown in the ad account's own currency

3. **Connect Facebook**: Facebook Login, or paste a token from the Graph API Explorer.
   The token is kept only in the server session and is never sent back to the browser.

## Setup

### Prerequisites

- Node.js 20 or newer
- A Facebook app with the Marketing API product added

### Backend

```
cd backend
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```

Edit `backend/.env`:

```
FB_APP_ID=your_facebook_app_id
FB_APP_SECRET=your_facebook_app_secret
SESSION_SECRET=a_long_random_string
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

Generate a session secret with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start it:

```
npm start
```

### Frontend

```
cd frontend
npm install
npm start
```

The app opens at `http://localhost:3000`. To use a different backend address, copy
`frontend/.env.example` to `frontend/.env` and set `REACT_APP_API_URL`.

### Facebook Login (optional but recommended)

In your Facebook app, under Facebook Login → Settings, add this Valid OAuth Redirect URI:

```
http://localhost:5000/api/auth/facebook/callback
```

### Using a pasted token instead

1. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Add permissions: `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `pages_show_list`
4. Generate the token and paste it on the Connect Facebook page

If `FB_APP_ID` and `FB_APP_SECRET` are set, the backend exchanges it for a long-lived (about 60 day) token.

## API Endpoints

All endpoints except login/session require a connected session (cookie). No endpoint accepts an access token in the URL.

### Auth
- `GET  /api/auth/facebook/login`: start Facebook Login
- `GET  /api/auth/facebook/callback`: OAuth redirect target
- `POST /api/auth/save-token`: connect with a pasted token `{ accessToken }`
- `GET  /api/auth/session`: `{ authenticated, user }`
- `POST /api/auth/logout`
- `GET  /api/auth/accounts`: businesses, ad accounts, pages
- `GET  /api/auth/business-accounts?businessId=`
- `GET  /api/auth/pixels?adAccountId=`

### Campaigns
- `POST /api/campaigns/create`: campaign + ad set + creative + ad
- `POST /api/campaigns/upload-image`: `{ adAccountId, dataBase64 }` → `{ imageHash }`
- `POST /api/campaigns/upload-video`: multipart `adAccountId`, `video` → `{ videoId }`
- `GET  /api/campaigns/video-status/:videoId`

### Reporting
- `GET  /api/reporting/stats?adAccountId=&level=&datePreset=`
- `POST /api/reporting/pause`: `{ entityId, entityType }`
- `POST /api/reporting/activate`: `{ entityId, entityType }`
- `POST /api/reporting/update-budget`: `{ adAccountId, entityId, entityType, budget }`

## Notes

- Budgets and bids are typed in normal amounts (500 = 500.00) and converted to Meta's minor units on the server, using the ad account's currency.
- Uses Graph API v24.0 via `facebook-nodejs-business-sdk` 24.x. Meta retires API versions roughly two years after release, so update the SDK periodically.
- Sessions are stored in memory, so restarting the backend logs everyone out. Use a persistent session store (Redis, a database) for production.

## Tech Stack

**Backend:** Node.js, Express, Facebook Business SDK, express-session, helmet, multer

**Frontend:** React, React Router, Axios
