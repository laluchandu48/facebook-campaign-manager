const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
  bizSdk, apiFor, obj, fetchAll, sendError, fbErrorMessage, normalizeAdAccountId,
} = require('../lib/facebook');

const { AdAccount, Business, User, FacebookAdsApi } = bizSdk;
const GRAPH = `https://graph.facebook.com/${FacebookAdsApi.VERSION}`;
const SCOPES = 'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list';

/**
 * Swap a short-lived token (about 1-2 hours) for a long-lived one (about 60 days).
 * Needs FB_APP_ID and FB_APP_SECRET. If anything fails, keep the original token.
 */
async function exchangeForLongLivedToken(shortToken) {
  if (!process.env.FB_APP_ID || !process.env.FB_APP_SECRET) return shortToken;
  try {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: shortToken,
      },
    });
    return data.access_token || shortToken;
  } catch (error) {
    console.warn('Could not exchange for a long-lived token:', error.response?.data?.error?.message || error.message);
    return shortToken;
  }
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate(err => (err ? reject(err) : resolve())));
}

/** Store a token in a fresh session after confirming it actually works. */
async function startSession(req, token) {
  const me = await obj(User, 'me', apiFor(token)).read(['id', 'name']);
  const longLived = await exchangeForLongLivedToken(token);
  await regenerateSession(req); // prevents session fixation
  req.session.accessToken = longLived;
  req.session.user = { id: me.id, name: me.name };
  await saveSession(req);
  return req.session.user;
}

// ---- Facebook Login (OAuth) ----

router.get('/facebook/login', (req, res) => {
  if (!process.env.FB_APP_ID || !process.env.BACKEND_URL) {
    return res.status(500).json({ error: 'FB_APP_ID and BACKEND_URL must be set in backend/.env' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Failed to start login' });
    const params = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      redirect_uri: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
      scope: SCOPES,
      state,
    });
    res.json({ authUrl: `https://www.facebook.com/${FacebookAdsApi.VERSION}/dialog/oauth?${params}` });
  });
});

function popupResponse(res, type) {
  const origin = JSON.stringify(process.env.FRONTEND_URL || 'http://localhost:3000');
  res.set('Content-Security-Policy', "script-src 'unsafe-inline'");
  res.send(`<!doctype html><html><body>
    <p>${type === 'FB_AUTH_SUCCESS' ? 'Connected! You can close this window.' : 'Login failed. You can close this window.'}</p>
    <script>
      if (window.opener) { window.opener.postMessage({ type: '${type}' }, ${origin}); }
      window.close();
    </script>
  </body></html>`);
}

router.get('/facebook/callback', async (req, res) => {
  const { code, state } = req.query;
  const expectedState = req.session.oauthState;
  delete req.session.oauthState;

  if (!code || !state || !expectedState || state !== expectedState) {
    return popupResponse(res, 'FB_AUTH_ERROR');
  }

  try {
    const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
        code,
      },
    });
    await startSession(req, data.access_token);
    popupResponse(res, 'FB_AUTH_SUCCESS');
  } catch (error) {
    console.error('OAuth error:', error.response?.data?.error?.message || fbErrorMessage(error));
    popupResponse(res, 'FB_AUTH_ERROR');
  }
});

// ---- Manual token (pasted from Graph API Explorer) ----

router.post('/save-token', async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(400).json({ error: 'accessToken is required' });
  }
  try {
    const user = await startSession(req, accessToken.trim());
    res.json({ success: true, user });
  } catch (error) {
    sendError(res, error, 400);
  }
});

// ---- Session ----

// Tells the frontend whether it is connected. Never returns the token itself.
router.get('/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.session.accessToken),
    user: req.session.user || null,
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('fbcm.sid');
    res.json({ success: true });
  });
});

// ---- Accounts ----

router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const me = obj(User, 'me', req.fbApi);
    const [businesses, adAccounts, pages] = await Promise.all([
      me.getBusinesses(['id', 'name'], { limit: 100 }).then(c => fetchAll(c)),
      me.getAdAccounts(['id', 'name', 'account_status', 'currency', 'business'], { limit: 100 }).then(c => fetchAll(c)),
      // Note: page access tokens are deliberately NOT requested or sent to the browser.
      me.getAccounts(['id', 'name'], { limit: 100 }).then(c => fetchAll(c)),
    ]);
    res.json({ businesses, adAccounts, pages });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/business-accounts', requireAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: 'businessId is required' });
    const business = obj(Business, businessId, req.fbApi);
    const fields = ['id', 'name', 'account_status', 'currency'];
    const [owned, client] = await Promise.all([
      business.getOwnedAdAccounts(fields, { limit: 100 }).then(c => fetchAll(c)),
      business.getClientAdAccounts(fields, { limit: 100 }).then(c => fetchAll(c)).catch(() => []),
    ]);
    const byId = new Map([...owned, ...client].map(a => [a.id, a]));
    res.json({ adAccounts: [...byId.values()] });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/pixels', requireAuth, async (req, res) => {
  try {
    const account = obj(AdAccount, normalizeAdAccountId(req.query.adAccountId), req.fbApi);
    const pixels = await fetchAll(await account.getAdsPixels(['id', 'name'], { limit: 100 }));
    res.json({ pixels });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
