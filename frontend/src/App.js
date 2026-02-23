import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreateCampaign from './pages/CreateCampaign';
import Reporting from './pages/Reporting';
import ConnectFacebook from './pages/ConnectFacebook';
import './App.css';

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [pages, setPages] = useState([]);

  return (
    <Router>
      <div className="App">
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>AdFlow Pro</h2>
            <div className="sidebar-subtitle">Campaign Management Suite</div>
          </div>
          <nav>
            <Link to="/create-campaign">Create Campaign</Link>
            <Link to="/reporting">Reporting</Link>
            <Link to="/connect-facebook">Connect Facebook</Link>
          </nav>
        </div>
        <div className="main-content">
          <Routes>
            <Route path="/" element={
              <ConnectFacebook 
                setAccessToken={setAccessToken}
                setBusinesses={setBusinesses}
                setAdAccounts={setAdAccounts}
                setPages={setPages}
                businesses={businesses}
                adAccounts={adAccounts}
                pages={pages}
              />
            } />
            <Route path="/create-campaign" element={
              <CreateCampaign 
                accessToken={accessToken}
                businesses={businesses}
                adAccounts={adAccounts}
                pages={pages}
              />
            } />
            <Route path="/reporting" element={
              <Reporting 
                accessToken={accessToken} 
                adAccounts={adAccounts}
              />
            } />
            <Route path="/connect-facebook" element={
              <ConnectFacebook 
                setAccessToken={setAccessToken}
                setBusinesses={setBusinesses}
                setAdAccounts={setAdAccounts}
                setPages={setPages}
                businesses={businesses}
                adAccounts={adAccounts}
                pages={pages}
              />
            } />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
