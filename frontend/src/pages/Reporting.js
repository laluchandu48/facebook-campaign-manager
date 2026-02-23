import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Reporting({ accessToken, adAccounts }) {
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [businesses, setBusinesses] = useState([]);
  const [filteredAdAccounts, setFilteredAdAccounts] = useState([]);
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_30d');
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('spend');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortInsights = (data) => {
    return [...data].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      if (sortBy === 'spend') {
        aVal = parseFloat(a.spend || 0);
        bVal = parseFloat(b.spend || 0);
      } else if (sortBy === 'leads') {
        aVal = a.actions?.find(action => action.action_type === 'lead')?.value || 0;
        bVal = b.actions?.find(action => action.action_type === 'lead')?.value || 0;
      } else if (sortBy === 'cpc') {
        aVal = parseFloat(a.cpc || 0);
        bVal = parseFloat(b.cpc || 0);
      } else if (sortBy === 'cost_per_lead') {
        const leadsA = a.actions?.find(action => action.action_type === 'lead')?.value || 0;
        const leadsB = b.actions?.find(action => action.action_type === 'lead')?.value || 0;
        aVal = leadsA > 0 ? parseFloat(a.spend) / leadsA : 0;
        bVal = leadsB > 0 ? parseFloat(b.spend) / leadsB : 0;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  useEffect(() => {
    fetchBusinesses();
  }, [accessToken]);

  const fetchBusinesses = async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get('http://localhost:5000/api/auth/accounts', {
        params: { accessToken }
      });
      setBusinesses(response.data.businesses || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    }
  };

  const handleBusinessChange = async (businessId) => {
    setSelectedBusiness(businessId);
    setSelectedAdAccount('');
    
    if (businessId) {
      try {
        const response = await axios.get('http://localhost:5000/api/auth/business-accounts', {
          params: { accessToken, businessId }
        });
        setFilteredAdAccounts(response.data.adAccounts);
      } catch (error) {
        alert('Error fetching business accounts: ' + error.message);
      }
    } else {
      setFilteredAdAccounts(adAccounts);
    }
  };

  const fetchStats = async () => {
    if (!selectedAdAccount) {
      alert('Please select an ad account');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/reporting/stats', {
        params: {
          accessToken,
          adAccountId: selectedAdAccount,
          level,
          datePreset
        }
      });
      setInsights(sortInsights(response.data.insights));
    } catch (error) {
      alert('Error fetching stats: ' + error.message);
    }
    setLoading(false);
  };

  const handlePause = async (entityId, entityType) => {
    try {
      await axios.post('http://localhost:5000/api/reporting/pause', {
        accessToken,
        entityId,
        entityType
      });
      alert(`${entityType} paused successfully`);
      fetchStats();
    } catch (error) {
      alert('Error pausing: ' + error.message);
    }
  };

  const handleBudgetChange = async (entityId, entityType) => {
    const newBudget = prompt('Enter new daily budget:');
    if (!newBudget) return;

    try {
      await axios.post('http://localhost:5000/api/reporting/update-budget', {
        accessToken,
        entityId,
        entityType,
        budget: newBudget
      });
      alert('Budget updated successfully');
      fetchStats();
    } catch (error) {
      alert('Error updating budget: ' + error.message);
    }
  };

  return (
    <div className="page-container">
      <h1>Reporting</h1>

      <div className="form-group">
        <label>Select Business Manager</label>
        <select value={selectedBusiness} onChange={(e) => handleBusinessChange(e.target.value)}>
          <option value="">All Ad Accounts</option>
          {businesses.map(business => (
            <option key={business.id} value={business.id}>{business.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Select Ad Account</label>
        <select value={selectedAdAccount} onChange={(e) => setSelectedAdAccount(e.target.value)}>
          <option value="">Select an ad account</option>
          {(selectedBusiness ? filteredAdAccounts : adAccounts).map(account => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Level</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="campaign">Campaign</option>
          <option value="adset">Ad Set</option>
          <option value="ad">Ad</option>
        </select>
      </div>

      <div className="form-group">
        <label>Date Range</label>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last_7d">Last 7 Days</option>
          <option value="last_30d">Last 30 Days</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </div>

      <div className="form-group">
        <label>Sort By</label>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setInsights(sortInsights(insights)); }}>
          <option value="spend">Spend</option>
          <option value="leads">Leads</option>
          <option value="cpc">CPC</option>
          <option value="cost_per_lead">Cost Per Lead</option>
        </select>
      </div>

      <div className="form-group">
        <label>Sort Order</label>
        <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); setInsights(sortInsights(insights)); }}>
          <option value="desc">High to Low</option>
          <option value="asc">Low to High</option>
        </select>
      </div>

      <button onClick={fetchStats} className="btn btn-primary" disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Stats'}
      </button>

      {insights.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Status</th>
              <th>Spend</th>
              <th>Leads</th>
              <th>CPC</th>
              <th>Cost Per Lead</th>
              <th>Budget</th>
              <th>Amount Spent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {insights.map((insight, index) => {
              const leads = insight.actions?.find(action => action.action_type === 'lead')?.value || 0;
              const costPerLead = leads > 0 ? (parseFloat(insight.spend) / leads).toFixed(2) : '0.00';
              
              return (
                <tr key={index}>
                  <td>{insight.campaign_name || insight.adset_name || insight.ad_name}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '12px', 
                      fontSize: '11px',
                      fontWeight: '600',
                      background: insight.status === 'ACTIVE' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                      color: insight.status === 'ACTIVE' ? '#4ade80' : '#fbbf24'
                    }}>
                      {insight.status || 'PAUSED'}
                    </span>
                  </td>
                  <td>${parseFloat(insight.spend || 0).toFixed(2)}</td>
                  <td>{leads}</td>
                  <td>${parseFloat(insight.cpc || 0).toFixed(2)}</td>
                  <td>${costPerLead}</td>
                  <td>${parseFloat(insight.budget || 0).toFixed(2)}</td>
                  <td>${parseFloat(insight.spend || 0).toFixed(2)}</td>
                  <td>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handlePause(
                        insight.campaign_id || insight.adset_id || insight.ad_id, 
                        level
                      )}
                    >
                      Pause
                    </button>
                    {level !== 'ad' && (
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleBudgetChange(
                          insight.campaign_id || insight.adset_id, 
                          level
                        )}
                      >
                        Change Budget
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Reporting;
