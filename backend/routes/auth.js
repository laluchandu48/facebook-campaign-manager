const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const bizSdk = require('facebook-nodejs-business-sdk');

const AdAccount = bizSdk.AdAccount;
const Page = bizSdk.Page;
const Business = bizSdk.Business;

// Facebook OAuth login
router.get('/facebook/login', (req, res) => {
  const fbAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${process.env.FB_APP_ID}` +
    `&redirect_uri=${process.env.BACKEND_URL}/api/auth/facebook/callback` +
    `&scope=ads_management,ads_read,business_management,pages_read_engagement` +
    `&state=${Math.random().toString(36).substring(7)}`;
  
  res.json({ authUrl: fbAuthUrl });
});

// Facebook OAuth callback
router.get('/facebook/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/connect-facebook?error=no_code`);
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
        code: code
      }
    });

    const accessToken = tokenResponse.data.access_token;
    
    // Store in session
    req.session.accessToken = accessToken;
    req.session.save((err) => {
      if (err) {
        return res.redirect(`${process.env.FRONTEND_URL}/connect-facebook?error=session`);
      }
      // Redirect back to frontend
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'FB_AUTH_SUCCESS' }, '${process.env.FRONTEND_URL}');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'FB_AUTH_ERROR' }, '${process.env.FRONTEND_URL}');
            window.close();
          </script>
          <p>Authentication failed. You can close this window.</p>
        </body>
      </html>
    `);
  }
});

// Get session access token
router.get('/session', (req, res) => {
  if (req.session.accessToken) {
    res.json({ accessToken: req.session.accessToken, authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Save token to session
router.post('/save-token', (req, res) => {
  const { accessToken } = req.body;
  req.session.accessToken = accessToken;
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save session' });
    }
    res.json({ success: true });
  });
});

router.post('/connect', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    const api = bizSdk.FacebookAdsApi.init(accessToken);

    res.json({ success: true, message: 'Connected successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const { accessToken } = req.query;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }
    
    // Initialize API with app secret
    bizSdk.FacebookAdsApi.init(accessToken, process.env.FB_APP_SECRET);
    
    const account = new bizSdk.User('me');
    const businesses = await account.getBusinesses(['id', 'name']);
    const adAccounts = await account.getAdAccounts(['id', 'name', 'account_status', 'business']);
    const pages = await account.getAccounts(['id', 'name', 'access_token']);

    res.json({
      businesses: businesses,
      adAccounts: adAccounts,
      pages: pages
    });
  } catch (error) {
    console.error('Error fetching accounts:', error.message);
    console.error('Error details:', error.response?.data || error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/business-accounts', async (req, res) => {
  try {
    const { accessToken, businessId } = req.query;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    const business = new Business(businessId);
    const adAccounts = await business.getOwnedAdAccounts(['id', 'name', 'account_status']);

    res.json({
      adAccounts: adAccounts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pixels', async (req, res) => {
  try {
    const { accessToken, adAccountId } = req.query;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    const account = new AdAccount(adAccountId);
    const pixels = await account.getAdsPixels(['id', 'name']);

    res.json({
      pixels: pixels
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
