import React, { useMemo, useState } from 'react';
import api, { errorMessage } from '../api';

const CAPPED_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'];
const MAX_IMAGE_MB = 8;

const CALL_TO_ACTIONS = [
  ['LEARN_MORE', 'Learn More'], ['SHOP_NOW', 'Shop Now'], ['SIGN_UP', 'Sign Up'],
  ['CONTACT_US', 'Contact Us'], ['GET_OFFER', 'Get Offer'], ['GET_QUOTE', 'Get Quote'],
  ['ORDER_NOW', 'Order Now'], ['BOOK_TRAVEL', 'Book Now'], ['APPLY_NOW', 'Apply Now'],
  ['DOWNLOAD', 'Download'], ['SUBSCRIBE', 'Subscribe'], ['WHATSAPP_MESSAGE', 'Send WhatsApp Message'],
];

const emptyCampaign = {
  name: '',
  objective: 'OUTCOME_TRAFFIC',
  budgetLevel: 'campaign',
  dailyBudget: '',
  bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
};

const emptyAdSet = {
  name: '',
  performanceGoal: 'LINK_CLICKS',
  pixelId: '',
  eventType: 'PURCHASE',
  dailyBudget: '',
  bidCap: '',
  startTime: '',
  endTime: '',
  countries: '',
  ageMin: 18,
  ageMax: 65,
  gender: 'all',
};

const emptyAd = {
  name: '',
  creativeName: '',
  pageId: '',
  website: '',
  primaryText: '',
  headline: '',
  description: '',
  callToAction: 'LEARN_MORE',
  mediaType: 'image',
  imageHash: '',
  imagePreview: '',
  videoId: '',
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function CreateCampaign({ businesses = [], adAccounts = [], pages = [] }) {
  const [step, setStep] = useState(1);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [businessSearchTerm, setBusinessSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAdAccounts, setFilteredAdAccounts] = useState([]);
  const [pixels, setPixels] = useState([]);

  const [campaignData, setCampaignData] = useState(emptyCampaign);
  const [adSetData, setAdSetData] = useState(emptyAdSet);
  const [adData, setAdData] = useState(emptyAd);

  const [uploadStatus, setUploadStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const visibleAccounts = selectedBusiness ? filteredAdAccounts : adAccounts;
  const currency = useMemo(() => {
    const account = [...visibleAccounts, ...adAccounts].find(a => a.id === selectedAdAccount);
    return account?.currency || '';
  }, [visibleAccounts, adAccounts, selectedAdAccount]);
  const needsCap = CAPPED_STRATEGIES.includes(campaignData.bidStrategy);

  const handleBusinessChange = async (businessId) => {
    setSelectedBusiness(businessId);
    setSelectedAdAccount('');
    setPixels([]);
    setError('');
    if (!businessId) return;
    try {
      const { data } = await api.get('/auth/business-accounts', { params: { businessId } });
      setFilteredAdAccounts(data.adAccounts || []);
    } catch (err) {
      setError(`Error fetching business accounts: ${errorMessage(err)}`);
    }
  };

  const handleAdAccountChange = async (adAccountId) => {
    setSelectedAdAccount(adAccountId);
    setPixels([]);
    // Uploaded media belongs to one ad account, so reset it when the account changes.
    setAdData(d => ({ ...d, imageHash: '', imagePreview: '', videoId: '' }));
    setError('');
    if (!adAccountId) return;
    try {
      const { data } = await api.get('/auth/pixels', { params: { adAccountId } });
      setPixels(data.pixels || []);
    } catch (err) {
      setError(`Error fetching pixels: ${errorMessage(err)}`);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    if (!selectedAdAccount) { setError('Select an ad account before uploading media'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`Image must be under ${MAX_IMAGE_MB} MB`); return; }
    setError('');
    setUploadStatus('Uploading image…');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { data } = await api.post('/campaigns/upload-image', {
        adAccountId: selectedAdAccount,
        dataBase64: dataUrl,
      });
      setAdData(d => ({ ...d, imageHash: data.imageHash, imagePreview: dataUrl }));
      setUploadStatus('Image uploaded ✓');
    } catch (err) {
      setUploadStatus('');
      setError(`Image upload failed: ${errorMessage(err)}`);
    }
  };

  const handleVideoUpload = async (file) => {
    if (!file) return;
    if (!selectedAdAccount) { setError('Select an ad account before uploading media'); return; }
    setError('');
    try {
      const form = new FormData();
      form.append('adAccountId', selectedAdAccount);
      form.append('video', file);
      const { data } = await api.post('/campaigns/upload-video', form, {
        onUploadProgress: (e) => {
          if (e.total) setUploadStatus(`Uploading video… ${Math.round((e.loaded / e.total) * 100)}%`);
        },
      });
      setAdData(d => ({ ...d, videoId: data.videoId }));

      // Facebook processes videos after upload; wait (up to ~3 min) until it is ready.
      for (let i = 0; i < 36; i += 1) {
        setUploadStatus('Facebook is processing the video…');
        const { data: status } = await api.get(`/campaigns/video-status/${data.videoId}`);
        if (status.status === 'ready') { setUploadStatus('Video ready ✓'); return; }
        if (status.status === 'error') throw new Error('Facebook could not process this video');
        await sleep(5000);
      }
      setUploadStatus('Video uploaded. Still processing; you can try creating the ad in a minute.');
    } catch (err) {
      setUploadStatus('');
      setError(`Video upload failed: ${errorMessage(err)}`);
    }
  };

  const goToStep = (e, next) => {
    e.preventDefault();
    if (!selectedAdAccount) { setError('Select an ad account first'); return; }
    setError('');
    setStep(next);
  };

  const handleAdSubmit = async (e) => {
    e.preventDefault();
    if (adData.mediaType === 'image' && !adData.imageHash) { setError('Upload an image (or enter an image hash)'); return; }
    if (adData.mediaType === 'video' && !adData.videoId) { setError('Upload a video (or enter a video ID)'); return; }

    setSubmitting(true);
    setError('');
    setSuccess(null);
    try {
      const toIso = (v) => (v ? new Date(v).toISOString() : undefined); // keeps the user's timezone
      const { data } = await api.post('/campaigns/create', {
        adAccountId: selectedAdAccount,
        campaignData,
        adSetData: {
          ...adSetData,
          countries: adSetData.countries.split(/[\s,]+/).filter(Boolean),
          genders: adSetData.gender === 'male' ? [1] : adSetData.gender === 'female' ? [2] : undefined,
          startTime: toIso(adSetData.startTime),
          endTime: toIso(adSetData.endTime),
          bidCap: needsCap ? adSetData.bidCap : '',
        },
        adData: {
          name: adData.name,
          creativeName: adData.creativeName,
          pageId: adData.pageId,
          website: adData.website,
          primaryText: adData.primaryText,
          headline: adData.headline,
          description: adData.description,
          callToAction: adData.callToAction,
          mediaType: adData.mediaType,
          imageHash: adData.imageHash,
          videoId: adData.mediaType === 'video' ? adData.videoId : undefined,
        },
      });
      setSuccess(data);
      setStep(1);
      setCampaignData(emptyCampaign);
      setAdSetData(emptyAdSet);
      setAdData(emptyAd);
      setUploadStatus('');
    } catch (err) {
      setError(`Error creating campaign: ${errorMessage(err)}`);
    }
    setSubmitting(false);
  };

  const money = currency ? ` (${currency})` : '';

  return (
    <div className="page-container">
      <h1>Create Campaign</h1>

      {error && <div className="notice notice-error">{error}</div>}
      {success && (
        <div className="notice notice-success">
          Campaign created (paused). Campaign ID {success.campaignId}, ad set ID {success.adSetId}, ad ID {success.adId}.
          Review it in Ads Manager and switch it on from the Reporting page when ready.
        </div>
      )}

      <div className="form-group">
        <label>Select Business Manager</label>
        <input
          type="text"
          placeholder="Search business managers..."
          value={businessSearchTerm}
          onChange={(e) => setBusinessSearchTerm(e.target.value)}
          style={{ marginBottom: '10px' }}
        />
        <select value={selectedBusiness} onChange={(e) => handleBusinessChange(e.target.value)}>
          <option value="">All Ad Accounts</option>
          {businesses
            .filter(b => (b.name || '').toLowerCase().includes(businessSearchTerm.toLowerCase()))
            .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Select Ad Account</label>
        <input
          type="text"
          placeholder="Search ad accounts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: '10px' }}
        />
        <select value={selectedAdAccount} onChange={(e) => handleAdAccountChange(e.target.value)}>
          <option value="">Select an ad account</option>
          {visibleAccounts
            .filter(a => (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(a => <option key={a.id} value={a.id}>{a.name}{a.currency ? ` (${a.currency})` : ''}</option>)}
        </select>
      </div>

      {step === 1 && (
        <form onSubmit={(e) => goToStep(e, 2)}>
          <h2>Step 1: Campaign Details</h2>

          <div className="form-group">
            <label>Campaign Name</label>
            <input type="text" value={campaignData.name} required
              onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Objective</label>
            <select value={campaignData.objective}
              onChange={(e) => setCampaignData({ ...campaignData, objective: e.target.value })}>
              <option value="OUTCOME_TRAFFIC">Traffic</option>
              <option value="OUTCOME_ENGAGEMENT">Engagement</option>
              <option value="OUTCOME_LEADS">Leads</option>
              <option value="OUTCOME_SALES">Sales</option>
              <option value="OUTCOME_AWARENESS">Awareness</option>
            </select>
          </div>

          <div className="form-group">
            <label>Where should the budget be set?</label>
            <div className="inline-options">
              <label>
                <input type="radio" name="budgetLevel" checked={campaignData.budgetLevel === 'campaign'}
                  onChange={() => setCampaignData({ ...campaignData, budgetLevel: 'campaign' })} />
                Campaign budget (Advantage+ campaign budget)
              </label>
              <label>
                <input type="radio" name="budgetLevel" checked={campaignData.budgetLevel === 'adset'}
                  onChange={() => setCampaignData({ ...campaignData, budgetLevel: 'adset' })} />
                Ad set budget
              </label>
            </div>
          </div>

          {campaignData.budgetLevel === 'campaign' && (
            <div className="form-group">
              <label>Daily Budget{money}</label>
              <input type="number" min="1" step="0.01" value={campaignData.dailyBudget} required
                placeholder="e.g. 500"
                onChange={(e) => setCampaignData({ ...campaignData, dailyBudget: e.target.value })} />
              <small>Enter the normal amount (500 means 500.00). It is converted for Facebook automatically.</small>
            </div>
          )}

          <div className="form-group">
            <label>Bid Strategy</label>
            <select value={campaignData.bidStrategy}
              onChange={(e) => setCampaignData({ ...campaignData, bidStrategy: e.target.value })}>
              <option value="LOWEST_COST_WITHOUT_CAP">Highest volume (lowest cost)</option>
              <option value="COST_CAP">Cost per result goal (cost cap)</option>
              <option value="LOWEST_COST_WITH_BID_CAP">Bid cap</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">Next</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => goToStep(e, 3)}>
          <h2>Step 2: Ad Set Details</h2>

          <div className="form-group">
            <label>Ad Set Name</label>
            <input type="text" value={adSetData.name} required
              onChange={(e) => setAdSetData({ ...adSetData, name: e.target.value })} />
          </div>

          {campaignData.budgetLevel === 'adset' && (
            <div className="form-group">
              <label>Ad Set Daily Budget{money}</label>
              <input type="number" min="1" step="0.01" value={adSetData.dailyBudget} required
                onChange={(e) => setAdSetData({ ...adSetData, dailyBudget: e.target.value })} />
            </div>
          )}

          <div className="form-group">
            <label>Performance Goal</label>
            <select value={adSetData.performanceGoal}
              onChange={(e) => setAdSetData({ ...adSetData, performanceGoal: e.target.value })}>
              <option value="LINK_CLICKS">Link Clicks</option>
              <option value="LANDING_PAGE_VIEWS">Landing Page Views</option>
              <option value="IMPRESSIONS">Impressions</option>
              <option value="REACH">Reach</option>
              <option value="OFFSITE_CONVERSIONS">Conversions (needs a pixel)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Pixel</label>
            <select value={adSetData.pixelId} required={adSetData.performanceGoal === 'OFFSITE_CONVERSIONS'}
              onChange={(e) => setAdSetData({ ...adSetData, pixelId: e.target.value })}>
              <option value="">No pixel</option>
              {pixels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </div>

          {adSetData.pixelId && (
            <div className="form-group">
              <label>Conversion Event</label>
              <select value={adSetData.eventType}
                onChange={(e) => setAdSetData({ ...adSetData, eventType: e.target.value })}>
                <option value="PURCHASE">Purchase</option>
                <option value="ADD_TO_CART">Add to Cart</option>
                <option value="LEAD">Lead</option>
                <option value="COMPLETE_REGISTRATION">Complete Registration</option>
              </select>
            </div>
          )}

          {needsCap && (
            <div className="form-group">
              <label>{campaignData.bidStrategy === 'COST_CAP' ? 'Cost per result goal' : 'Bid cap'}{money}</label>
              <input type="number" min="0.01" step="0.01" value={adSetData.bidCap} required
                onChange={(e) => setAdSetData({ ...adSetData, bidCap: e.target.value })} />
            </div>
          )}

          <div className="form-group">
            <label>Countries</label>
            <input type="text" value={adSetData.countries} required placeholder="e.g. IN, US, GB"
              onChange={(e) => setAdSetData({ ...adSetData, countries: e.target.value })} />
            <small>Two-letter country codes, separated by commas.</small>
          </div>

          <div className="form-group">
            <label>Age Min</label>
            <input type="number" min="13" max="65" value={adSetData.ageMin}
              onChange={(e) => setAdSetData({ ...adSetData, ageMin: parseInt(e.target.value, 10) || 18 })} />
          </div>

          <div className="form-group">
            <label>Age Max</label>
            <input type="number" min="13" max="65" value={adSetData.ageMax}
              onChange={(e) => setAdSetData({ ...adSetData, ageMax: parseInt(e.target.value, 10) || 65 })} />
          </div>

          <div className="form-group">
            <label>Gender</label>
            <select value={adSetData.gender} onChange={(e) => setAdSetData({ ...adSetData, gender: e.target.value })}>
              <option value="all">All</option>
              <option value="male">Men</option>
              <option value="female">Women</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start Time (optional)</label>
            <input type="datetime-local" value={adSetData.startTime}
              onChange={(e) => setAdSetData({ ...adSetData, startTime: e.target.value })} />
          </div>

          <div className="form-group">
            <label>End Time (optional)</label>
            <input type="datetime-local" value={adSetData.endTime}
              onChange={(e) => setAdSetData({ ...adSetData, endTime: e.target.value })} />
          </div>

          <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
          <button type="submit" className="btn btn-primary">Next</button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleAdSubmit}>
          <h2>Step 3: Ad Details</h2>

          <div className="form-group">
            <label>Ad Name</label>
            <input type="text" value={adData.name} required
              onChange={(e) => setAdData({ ...adData, name: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Creative Name (optional)</label>
            <input type="text" value={adData.creativeName}
              onChange={(e) => setAdData({ ...adData, creativeName: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Facebook Page</label>
            <select value={adData.pageId} required
              onChange={(e) => setAdData({ ...adData, pageId: e.target.value })}>
              <option value="">Select a page</option>
              {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Website URL</label>
            <input type="url" value={adData.website} placeholder="https://example.com" required
              onChange={(e) => setAdData({ ...adData, website: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Primary Text</label>
            <textarea value={adData.primaryText} rows="3" required
              placeholder="Main ad copy that appears above the creative"
              onChange={(e) => setAdData({ ...adData, primaryText: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Headline</label>
            <input type="text" value={adData.headline} maxLength="40" required placeholder="Headline text"
              onChange={(e) => setAdData({ ...adData, headline: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <input type="text" value={adData.description} maxLength="30" placeholder="Additional description"
              onChange={(e) => setAdData({ ...adData, description: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Call to Action</label>
            <select value={adData.callToAction}
              onChange={(e) => setAdData({ ...adData, callToAction: e.target.value })}>
              {CALL_TO_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Media Type</label>
            <select value={adData.mediaType}
              onChange={(e) => { setUploadStatus(''); setAdData({ ...adData, mediaType: e.target.value }); }}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          {adData.mediaType === 'image' && (
            <div className="form-group">
              <label>Upload Image</label>
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => handleImageUpload(e.target.files[0])} />
              {adData.imagePreview && (
                <img src={adData.imagePreview} alt="Ad preview"
                  style={{ maxWidth: '240px', marginTop: '12px', borderRadius: '8px' }} />
              )}
              <small>Or enter an image hash from your ad account's media library</small>
              <input type="text" value={adData.imageHash} placeholder="Image hash" style={{ marginTop: '10px' }}
                onChange={(e) => setAdData({ ...adData, imageHash: e.target.value, imagePreview: '' })} />
            </div>
          )}

          {adData.mediaType === 'video' && (
            <div className="form-group">
              <label>Upload Video</label>
              <input type="file" accept="video/mp4,video/quicktime,video/*"
                onChange={(e) => handleVideoUpload(e.target.files[0])} />
              <small>Or enter a video ID that is already in this ad account</small>
              <input type="text" value={adData.videoId} placeholder="Video ID" style={{ marginTop: '10px' }}
                onChange={(e) => setAdData({ ...adData, videoId: e.target.value })} />
              <label style={{ marginTop: '16px' }}>Thumbnail image (optional)</label>
              <input type="file" accept="image/jpeg,image/png"
                onChange={(e) => handleImageUpload(e.target.files[0])} />
              <small>If you skip this, Facebook's auto-generated thumbnail is used.</small>
            </div>
          )}

          {uploadStatus && <p className="hint">{uploadStatus}</p>}

          <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Campaign'}
          </button>
        </form>
      )}
    </div>
  );
}

export default CreateCampaign;
