import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ConnectFacebook({ setAccessToken, setBusinesses, setAdAccounts, setPages, businesses, adAccounts, pages }) {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/session', {
        withCredentials: true
      });
      
      if (response.data.authenticated) {
        setAccessToken(response.data.accessToken);
        fetchAccounts(response.data.accessToken);
        setConnected(true);
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
  };

  const handleConnect = async () => {
    if (!token) {
      alert('Please enter an access token');
      return;
    }

    setLoading(true);
    try {
      // Save to backend session
      await axios.post('http://localhost:5000/api/auth/save-token', 
        { accessToken: token },
        { withCredentials: true }
      );
      
      setAccessToken(token);
      await fetchAccounts(token);
      setConnected(true);
    } catch (error) {
      alert('Error connecting: ' + error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout', {}, {
        withCredentials: true
      });
      setAccessToken('');
      setBusinesses([]);
      setAdAccounts([]);
      setPages([]);
      setToken('');
      setConnected(false);
    } catch (error) {
      alert('Error logging out: ' + error.message);
    }
  };

  const fetchAccounts = async (accessToken) => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/accounts', {
        params: { accessToken }
      });

      setBusinesses(response.data.businesses || []);
      setAdAccounts(response.data.adAccounts);
      setPages(response.data.pages);
    } catch (error) {
      alert('Error fetching accounts: ' + error.message);
    }
  };

  return (
    <div className="page-container">
      <h1>Connect Facebook</h1>

      {!connected ? (
        <div>
          <div style={{ background: '#f7fafc', padding: '30px', borderRadius: '12px', marginBottom: '30px' }}>
            <h3 style={{ marginTop: 0, color: '#2d3748' }}>How to get your Access Token:</h3>
            <ol style={{ color: '#4a5568', lineHeight: '1.8' }}>
              <li>Go to <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', fontWeight: 600 }}>Facebook Graph API Explorer</a></li>
              <li>Select your app from the dropdown</li>
              <li>Click "Generate Access Token"</li>
              <li>Grant permissions: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>ads_management, ads_read, business_management, pages_read_engagement</code></li>
              <li>Copy the access token and paste it below</li>
            </ol>
          </div>

          <div className="form-group">
            <label>Facebook Access Token</label>
            <textarea 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Facebook access token here"
              rows="4"
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </div>

          <button 
            onClick={handleConnect} 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: 0, color: '#48bb78' }}>✓ Connected Successfully!</h2>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>

          <h3>Business Managers</h3>
          <div className="account-list">
            {businesses.length > 0 ? (
              businesses.map(business => (
                <div key={business.id} className="account-item">
                  <strong>{business.name}</strong>
                  <p>ID: {business.id}</p>
                </div>
              ))
            ) : (
              <p>No business managers found</p>
            )}
          </div>

          <h3>Ad Accounts</h3>
          <div className="account-list">
            {adAccounts.length > 0 ? (
              adAccounts.map(account => (
                <div key={account.id} className="account-item">
                  <strong>{account.name}</strong>
                  <p>ID: {account.id}</p>
                  <p>Status: {account.account_status}</p>
                </div>
              ))
            ) : (
              <p>No ad accounts found</p>
            )}
          </div>

          <h3>Pages</h3>
          <div className="account-list">
            {pages.length > 0 ? (
              pages.map(page => (
                <div key={page.id} className="account-item">
                  <strong>{page.name}</strong>
                  <p>ID: {page.id}</p>
                </div>
              ))
            ) : (
              <p>No pages found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectFacebook;
