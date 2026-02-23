# Facebook Campaign Manager

A web application to create, launch, and optimize Facebook ad campaigns in one place.

## Features

1. **Create Campaign** - Multi-step campaign creation workflow
   - Campaign details (name, objective, budget, bid strategy)
   - Ad Set configuration (targeting, demographics, placements, schedule)
   - Ad creation (creative, message, link)
   - Ad account selection

2. **Reporting** - View campaign statistics and manage campaigns
   - View all Facebook ad metrics (impressions, clicks, spend, CTR, CPC, CPM, etc.)
   - Pause campaigns, ad sets, and ads
   - Change budgets for campaigns and ad sets
   - Filter by date range and level (campaign/adset/ad)

3. **Connect Facebook** - Facebook account integration
   - Connect using Facebook access token
   - View all accessible ad accounts
   - View all accessible pages

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Facebook Developer Account
- Facebook App with Marketing API access

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
copy .env.example .env
```

4. Update `.env` with your Facebook credentials:
```
PORT=5000
FB_APP_ID=your_facebook_app_id
FB_APP_SECRET=your_facebook_app_secret
FB_ACCESS_TOKEN=your_access_token
```

5. Start the backend server:
```bash
npm start
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Getting Facebook Access Token

1. Go to [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Add required permissions:
   - ads_management
   - ads_read
   - business_management
   - pages_read_engagement
4. Generate Access Token
5. Use this token in the "Connect Facebook" page

## API Endpoints

### Auth Routes
- `POST /api/auth/connect` - Connect to Facebook
- `GET /api/auth/accounts` - Get ad accounts and pages

### Campaign Routes
- `POST /api/campaigns/create` - Create campaign with ad set and ad

### Reporting Routes
- `GET /api/reporting/stats` - Get campaign statistics
- `POST /api/reporting/pause` - Pause campaign/adset/ad
- `POST /api/reporting/update-budget` - Update budget

## Tech Stack

**Backend:**
- Node.js
- Express
- Facebook Business SDK

**Frontend:**
- React
- React Router
- Axios

## Notes

- All campaigns, ad sets, and ads are created in PAUSED status by default
- Make sure your Facebook app has proper permissions for Marketing API
- Access tokens expire - you may need to regenerate them periodically
