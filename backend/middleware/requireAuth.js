const { apiFor } = require('../lib/facebook');

/**
 * The Facebook access token lives only in the server-side session.
 * The browser never sees it and never sends it in a URL.
 */
module.exports = function requireAuth(req, res, next) {
  const token = req.session && req.session.accessToken;
  if (!token) {
    return res.status(401).json({ error: 'Not connected to Facebook. Please connect first.' });
  }
  req.fbApi = apiFor(token);
  next();
};
