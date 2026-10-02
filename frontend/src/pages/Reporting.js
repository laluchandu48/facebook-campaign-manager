import React, { useMemo, useState } from 'react';
import api, { errorMessage, formatMoney } from '../api';

const leadsOf = (row) => Number(row.actions?.find(a => a.action_type === 'lead')?.value || 0);
const costPerLeadOf = (row) => {
  const leads = leadsOf(row);
  return leads > 0 ? Number(row.spend || 0) / leads : 0;
};

const SORTERS = {
  spend: (r) => Number(r.spend || 0),
  leads: leadsOf,
  cpc: (r) => Number(r.cpc || 0),
  ctr: (r) => Number(r.ctr || 0),
  cost_per_lead: costPerLeadOf,
};

const LEVEL_LABELS = { campaign: 'Campaign', adset: 'Ad Set', ad: 'Ad' };

function Reporting({ businesses = [], adAccounts = [] }) {
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [filteredAdAccounts, setFilteredAdAccounts] = useState([]);
  const [level, setLevel] = useState('campaign');
  const [datePreset, setDatePreset] = useState('last_30d');
  const [rows, setRows] = useState([]);
  const [loadedLevel, setLoadedLevel] = useState('campaign');
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [sortBy, setSortBy] = useState('spend');
  const [sortOrder, setSortOrder] = useState('desc');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fetched, setFetched] = useState(false);

  // Sorting is derived from current state, so changing the dropdowns always uses the new value.
  const sortedRows = useMemo(() => {
    const getValue = SORTERS[sortBy] || SORTERS.spend;
    return [...rows].sort((a, b) => (sortOrder === 'asc' ? getValue(a) - getValue(b) : getValue(b) - getValue(a)));
  }, [rows, sortBy, sortOrder]);

  const handleBusinessChange = async (businessId) => {
    setSelectedBusiness(businessId);
    setSelectedAdAccount('');
    setError('');
    if (!businessId) return;
    try {
      const { data } = await api.get('/auth/business-accounts', { params: { businessId } });
      setFilteredAdAccounts(data.adAccounts || []);
    } catch (err) {
      setError(`Error fetching business accounts: ${errorMessage(err)}`);
    }
  };

  const fetchStats = async () => {
    if (!selectedAdAccount) {
      setError('Please select an ad account');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.get('/reporting/stats', {
        params: { adAccountId: selectedAdAccount, level, datePreset },
      });
      setRows(data.insights || []);
      setCurrency(data.currency || '');
      setLoadedLevel(data.level || level);
      setFetched(true);
    } catch (err) {
      setError(`Error fetching stats: ${errorMessage(err)}`);
    }
    setLoading(false);
  };

  const setStatus = async (row, action) => {
    const verb = action === 'pause' ? 'Pause' : 'Activate';
    if (action === 'activate' && !window.confirm(`Activate "${row.name}"? It will start spending money.`)) return;
    setBusyId(row.id);
    setError('');
    try {
      await api.post(`/reporting/${action}`, { entityId: row.id, entityType: loadedLevel });
      setMessage(`${verb}d "${row.name}"`);
      await fetchStats();
    } catch (err) {
      setError(`Could not ${verb.toLowerCase()}: ${errorMessage(err)}`);
    }
    setBusyId('');
  };

  const handleBudgetChange = async (row) => {
    const label = row.budgetType === 'lifetime' ? 'lifetime' : 'daily';
    const input = window.prompt(
      `New ${label} budget for "${row.name}"${currency ? ` in ${currency}` : ''} (e.g. 500 or 750.50):`,
      row.budget ?? '',
    );
    if (input === null || input.trim() === '') return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a positive number for the budget');
      return;
    }
    setBusyId(row.id);
    setError('');
    try {
      await api.post('/reporting/update-budget', {
        adAccountId: selectedAdAccount,
        entityId: row.id,
        entityType: loadedLevel,
        budget: amount,
      });
      setMessage(`Updated budget for "${row.name}" to ${formatMoney(amount, currency)}`);
      await fetchStats();
    } catch (err) {
      setError(`Could not update budget: ${errorMessage(err)}`);
    }
    setBusyId('');
  };

  const accountOptions = selectedBusiness ? filteredAdAccounts : adAccounts;

  return (
    <div className="page-container">
      <h1>Reporting</h1>

      {error && <div className="notice notice-error">{error}</div>}
      {message && <div className="notice notice-success">{message}</div>}

      <div className="form-group">
        <label>Select Business Manager</label>
        <select value={selectedBusiness} onChange={(e) => handleBusinessChange(e.target.value)}>
          <option value="">All Ad Accounts</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Select Ad Account</label>
        <select value={selectedAdAccount} onChange={(e) => setSelectedAdAccount(e.target.value)}>
          <option value="">Select an ad account</option>
          {accountOptions.map(a => (
            <option key={a.id} value={a.id}>{a.name}{a.currency ? ` (${a.currency})` : ''}</option>
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
          <option value="last_14d">Last 14 Days</option>
          <option value="last_30d">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="maximum">Lifetime</option>
        </select>
      </div>

      <div className="form-group">
        <label>Sort By</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="spend">Spend</option>
          <option value="leads">Leads</option>
          <option value="cpc">CPC</option>
          <option value="ctr">CTR</option>
          <option value="cost_per_lead">Cost Per Lead</option>
        </select>
      </div>

      <div className="form-group">
        <label>Sort Order</label>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="desc">High to Low</option>
          <option value="asc">Low to High</option>
        </select>
      </div>

      <button onClick={fetchStats} className="btn btn-primary" disabled={loading}>
        {loading ? 'Loading…' : 'Fetch Stats'}
      </button>

      {fetched && !loading && sortedRows.length === 0 && (
        <p className="hint" style={{ marginTop: '20px' }}>No delivery in this date range.</p>
      )}

      {sortedRows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{LEVEL_LABELS[loadedLevel]} Name</th>
                <th>Status</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>Leads</th>
                <th>Cost Per Lead</th>
                <th>Budget</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => {
                const leads = leadsOf(row);
                const isActive = row.status === 'ACTIVE';
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <span
                        title={row.effectiveStatus && row.effectiveStatus !== row.status ? `Delivery: ${row.effectiveStatus}` : ''}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: isActive ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                          color: isActive ? '#4ade80' : '#fbbf24',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{formatMoney(row.spend, currency)}</td>
                    <td>{Number(row.impressions || 0).toLocaleString()}</td>
                    <td>{Number(row.clicks || 0).toLocaleString()}</td>
                    <td>{Number(row.ctr || 0).toFixed(2)}%</td>
                    <td>{formatMoney(row.cpc, currency)}</td>
                    <td>{leads}</td>
                    <td>{leads > 0 ? formatMoney(costPerLeadOf(row), currency) : '—'}</td>
                    <td>
                      {row.budget
                        ? `${formatMoney(row.budget, currency)}${row.budgetType === 'lifetime' ? ' lifetime' : '/day'}`
                        : <span className="hint">{loadedLevel === 'ad' ? '—' : 'Set at other level'}</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isActive ? (
                        <button className="btn btn-danger" disabled={busy} onClick={() => setStatus(row, 'pause')}>Pause</button>
                      ) : (
                        <button className="btn btn-primary" disabled={busy} onClick={() => setStatus(row, 'activate')}>Activate</button>
                      )}
                      {loadedLevel !== 'ad' && row.budget && (
                        <button className="btn btn-secondary" disabled={busy} onClick={() => handleBudgetChange(row)}>
                          Change Budget
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Reporting;
