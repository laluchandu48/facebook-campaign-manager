import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CreateCampaign from './pages/CreateCampaign';
import Reporting from './pages/Reporting';
import ConnectFacebook from './pages/ConnectFacebook';
import api, { errorMessage } from './api';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [pages, setPages] = useState([]);
  const [accountsError, setAccountsError] = useState('');

  const loadAccounts = useCallback(async () => {
    setAccountsError('');
    try {
      const { data } = await api.get('/auth/accounts');
      setBusinesses(data.businesses || []);
      setAdAccounts(data.adAccounts || []);
      setPages(data.pages || []);
    } catch (error) {
      setAccountsError(errorMessage(error));
    }
  }, []);

  // Check the server session on load, so refreshing any page keeps you connected.
  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/session');
      setConnected(data.authenticated);
      setUser(data.user);
      if (data.authenticated) await loadAccounts();
    } catch (error) {
      setAccountsError(`Cannot reach the backend: ${errorMessage(error)}`);
    } finally {
      setChecking(false);
    }
  }, [loadAccounts]);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    setConnected(false);
    setUser(null);
    setBusinesses([]);
    setAdAccounts([]);
    setPages([]);
  };

  const connectPage = (
    <ConnectFacebook
      connected={connected}
      checking={checking}
      user={user}
      businesses={businesses}
      adAccounts={adAccounts}
      pages={pages}
      accountsError={accountsError}
      onConnected={refreshSession}
      onLogout={handleLogout}
    />
  );

  const needsConnection = (element) => (connected ? element : connectPage);

  return (
    <Router>
      <div className="App">
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>AdFlow Pro</h2>
            <div className="sidebar-subtitle">Campaign Management Suite</div>
          </div>
          <nav>
            <NavLink to="/create-campaign">Create Campaign</NavLink>
            <NavLink to="/reporting">Reporting</NavLink>
            <NavLink to="/connect-facebook">Connect Facebook</NavLink>
          </nav>
        </div>
        <div className="main-content">
          <Routes>
            <Route path="/" element={connectPage} />
            <Route path="/connect-facebook" element={connectPage} />
            <Route path="/create-campaign" element={needsConnection(
              <CreateCampaign businesses={businesses} adAccounts={adAccounts} pages={pages} />
            )} />
            <Route path="/reporting" element={needsConnection(
              <Reporting businesses={businesses} adAccounts={adAccounts} />
            )} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
