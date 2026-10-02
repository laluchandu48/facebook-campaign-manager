import React, { useEffect, useState } from 'react';
import api, { API_URL, errorMessage } from '../api';

function ConnectFacebook({
  connected, checking, user, businesses, adAccounts, pages, accountsError, onConnected, onLogout,
}) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The Facebook Login popup (served by the backend) reports back with postMessage.
  useEffect(() => {
    const backendOrigin = new URL(API_URL).origin;
    const onMessage = (event) => {
      if (event.origin !== backendOrigin) return;
      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        setError('');
        onConnected();
      } else if (event.data?.type === 'FB_AUTH_ERROR') {
        setError('Facebook login failed or was cancelled. Please try again.');
      }
      setLoading(false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onConnected]);

  const handleFacebookLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.get('/auth/facebook/login');
      const popup = window.open(data.authUrl, 'fb-login', 'width=600,height=700');
      if (!popup) {
        setError('The login popup was blocked. Allow popups for this site and try again.');
        setLoading(false);
      }
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  const handleConnectWithToken = async () => {
    if (!token.trim()) {
      setError('Please paste an access token');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/save-token', { accessToken: token.trim() });
      setToken('');
      await onConnected();
    } catch (err) {
      setError(`Could not connect: ${errorMessage(err)}`);
    }
    setLoading(false);
  };

  if (checking) {
    return <div className="page-container"><h1>Connect Facebook</h1><p>Checking connection…</p></div>;
  }

  return (
    <div className="page-container">
      <h1>Connect Facebook</h1>

      {error && <div className="notice notice-error">{error}</div>}
      {accountsError && <div className="notice notice-error">{accountsError}</div>}

      {!connected ? (
        <div>
          <div className="info-box">
            <h3>Option 1: Log in with Facebook</h3>
            <p>Recommended. Requires FB_APP_ID, FB_APP_SECRET and BACKEND_URL in the backend .env, and
              <code>{` ${API_URL}/api/auth/facebook/callback `}</code>
              added as a Valid OAuth Redirect URI in your Facebook app.</p>
            <button onClick={handleFacebookLogin} className="btn btn-primary" disabled={loading}>
              {loading ? 'Waiting for Facebook…' : 'Log in with Facebook'}
            </button>
          </div>

          <div className="info-box">
            <h3>Option 2: Paste an access token</h3>
            <ol>
              <li>Go to the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer">Graph API Explorer</a></li>
              <li>Select your app from the dropdown</li>
              <li>Add permissions: <code>ads_management, ads_read, business_management, pages_read_engagement, pages_show_list</code></li>
              <li>Click "Generate Access Token", then copy it and paste it below</li>
            </ol>
            <p className="hint">The token is stored only on the server. If the backend has your app ID and secret, it is
              automatically exchanged for a long-lived (about 60 day) token.</p>
          </div>

          <div className="form-group">
            <label>Facebook Access Token</label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Facebook access token here"
              rows="4"
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
              autoComplete="off"
            />
          </div>

          <button onClick={handleConnectWithToken} className="btn btn-primary" disabled={loading}>
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: 0, color: '#48bb78' }}>✓ Connected{user?.name ? ` as ${user.name}` : ''}</h2>
            <div>
              <button onClick={onConnected} className="btn btn-secondary">Refresh</button>
              <button onClick={onLogout} className="btn btn-secondary">Logout</button>
            </div>
          </div>

          <h3>Business Managers</h3>
          <div className="account-list">
            {businesses.length > 0 ? businesses.map(business => (
              <div key={business.id} className="account-item">
                <strong>{business.name}</strong>
                <p>ID: {business.id}</p>
              </div>
            )) : <p>No business managers found</p>}
          </div>

          <h3>Ad Accounts</h3>
          <div className="account-list">
            {adAccounts.length > 0 ? adAccounts.map(account => (
              <div key={account.id} className="account-item">
                <strong>{account.name}</strong>
                <p>ID: {account.id}</p>
                <p>Status: {account.account_status === 1 ? 'Active' : account.account_status}{account.currency ? ` · ${account.currency}` : ''}</p>
              </div>
            )) : <p>No ad accounts found</p>}
          </div>

          <h3>Pages</h3>
          <div className="account-list">
            {pages.length > 0 ? pages.map(page => (
              <div key={page.id} className="account-item">
                <strong>{page.name}</strong>
                <p>ID: {page.id}</p>
              </div>
            )) : <p>No pages found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectFacebook;
