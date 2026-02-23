import React, { useState } from 'react';
import axios from 'axios';

function CreateCampaign({ accessToken, businesses, adAccounts, pages }) {
  const [step, setStep] = useState(1);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedAdAccount, setSelectedAdAccount] = useState('');
  const [businessSearchTerm, setBusinessSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAdAccounts, setFilteredAdAccounts] = useState([]);
  const [pixels, setPixels] = useState([]);
  
  const [campaignData, setCampaignData] = useState({
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    auctionType: 'AUCTION',
    dailyBudget: '',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP'
  });

  const [adSetData, setAdSetData] = useState({
    name: '',
    conversionLocation: 'WEBSITE',
    performanceGoal: 'LINK_CLICKS',
    pixelId: '',
    eventType: 'PURCHASE',
    bidCap: '',
    startTime: '',
    endTime: '',
    dailyBudget: '',
    geoLocations: { countries: ['US'] },
    ageMin: 18,
    ageMax: 65,
    genders: [1, 2]
  });

  const [adData, setAdData] = useState({
    name: '',
    creativeName: '',
    pageId: '',
    website: '',
    primaryText: '',
    headline: '',
    description: '',
    imageHash: '',
    videoId: '',
    mediaType: 'image'
  });

  const handleBusinessChange = async (businessId) => {
    setSelectedBusiness(businessId);
    setSelectedAdAccount('');
    setPixels([]);
    
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

  const handleAdAccountChange = async (adAccountId) => {
    setSelectedAdAccount(adAccountId);
    
    if (adAccountId) {
      try {
        const response = await axios.get('http://localhost:5000/api/auth/pixels', {
          params: { accessToken, adAccountId }
        });
        setPixels(response.data.pixels);
      } catch (error) {
        alert('Error fetching pixels: ' + error.message);
      }
    } else {
      setPixels([]);
    }
  };

  const handleCampaignSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleAdSetSubmit = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const handleAdSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post('http://localhost:5000/api/campaigns/create', {
        accessToken,
        adAccountId: selectedAdAccount,
        campaignData,
        adSetData,
        adData
      });

      alert('Campaign created successfully!');
      setStep(1);
      setCampaignData({ name: '', objective: 'OUTCOME_TRAFFIC', auctionType: 'AUCTION', dailyBudget: '', bidStrategy: 'LOWEST_COST_WITHOUT_CAP' });
      setAdSetData({ name: '', conversionLocation: 'WEBSITE', performanceGoal: 'LINK_CLICKS', pixelId: '', eventType: 'PURCHASE', bidCap: '', startTime: '', endTime: '', dailyBudget: '', geoLocations: { countries: ['US'] }, ageMin: 18, ageMax: 65, genders: [1, 2] });
      setAdData({ name: '', creativeName: '', pageId: '', website: '', primaryText: '', headline: '', description: '', imageHash: '', videoId: '', mediaType: 'image' });
    } catch (error) {
      alert('Error creating campaign: ' + error.message);
    }
  };

  return (
    <div className="page-container">
      <h1>Create Campaign</h1>
      
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
          {businesses && businesses
            .filter(business => business.name.toLowerCase().includes(businessSearchTerm.toLowerCase()))
            .map(business => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
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
          {(selectedBusiness ? filteredAdAccounts : adAccounts)
            .filter(account => account.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(account => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
        </select>
      </div>

      {step === 1 && (
        <form onSubmit={handleCampaignSubmit}>
          <h2>Step 1: Campaign Details</h2>
          
          <div className="form-group">
            <label>Campaign Name</label>
            <input 
              type="text" 
              value={campaignData.name}
              onChange={(e) => setCampaignData({...campaignData, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Objective</label>
            <select 
              value={campaignData.objective}
              onChange={(e) => setCampaignData({...campaignData, objective: e.target.value})}
            >
              <option value="OUTCOME_TRAFFIC">Traffic</option>
              <option value="OUTCOME_ENGAGEMENT">Engagement</option>
              <option value="OUTCOME_LEADS">Leads</option>
              <option value="OUTCOME_SALES">Sales</option>
            </select>
          </div>

          <div className="form-group">
            <label>Auction Type</label>
            <select 
              value={campaignData.auctionType}
              onChange={(e) => setCampaignData({...campaignData, auctionType: e.target.value})}
            >
              <option value="AUCTION">Auction</option>
              <option value="RESERVED">Reserved</option>
            </select>
          </div>

          <div className="form-group">
            <label>Daily Budget</label>
            <input 
              type="number" 
              value={campaignData.dailyBudget}
              onChange={(e) => setCampaignData({...campaignData, dailyBudget: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Bid Strategy</label>
            <select 
              value={campaignData.bidStrategy}
              onChange={(e) => setCampaignData({...campaignData, bidStrategy: e.target.value})}
            >
              <option value="LOWEST_COST_WITHOUT_CAP">Lowest Cost</option>
              <option value="COST_CAP">Cost Cap</option>
              <option value="LOWEST_COST_WITH_BID_CAP">Bid Cap</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">Next</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleAdSetSubmit}>
          <h2>Step 2: Ad Set Details</h2>
          
          <div className="form-group">
            <label>Ad Set Name</label>
            <input 
              type="text" 
              value={adSetData.name}
              onChange={(e) => setAdSetData({...adSetData, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Conversion Location</label>
            <select 
              value={adSetData.conversionLocation}
              onChange={(e) => setAdSetData({...adSetData, conversionLocation: e.target.value})}
            >
              <option value="WEBSITE">Website</option>
              <option value="APP">App</option>
              <option value="MESSENGER">Messenger</option>
            </select>
          </div>

          <div className="form-group">
            <label>Performance Goal</label>
            <select 
              value={adSetData.performanceGoal}
              onChange={(e) => setAdSetData({...adSetData, performanceGoal: e.target.value})}
            >
              <option value="LINK_CLICKS">Link Clicks</option>
              <option value="IMPRESSIONS">Impressions</option>
              <option value="REACH">Reach</option>
              <option value="OFFSITE_CONVERSIONS">Conversions</option>
            </select>
          </div>

          <div className="form-group">
            <label>Pixel ID</label>
            <select 
              value={adSetData.pixelId}
              onChange={(e) => setAdSetData({...adSetData, pixelId: e.target.value})}
            >
              <option value="">Select a pixel</option>
              {pixels.map(pixel => (
                <option key={pixel.id} value={pixel.id}>{pixel.name} ({pixel.id})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Event Type</label>
            <select 
              value={adSetData.eventType}
              onChange={(e) => setAdSetData({...adSetData, eventType: e.target.value})}
            >
              <option value="PURCHASE">Purchase</option>
              <option value="ADD_TO_CART">Add to Cart</option>
              <option value="LEAD">Lead</option>
              <option value="COMPLETE_REGISTRATION">Complete Registration</option>
            </select>
          </div>

          <div className="form-group">
            <label>Bid Cap</label>
            <input 
              type="number" 
              value={adSetData.bidCap}
              onChange={(e) => setAdSetData({...adSetData, bidCap: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Start Time</label>
            <input 
              type="datetime-local" 
              value={adSetData.startTime}
              onChange={(e) => setAdSetData({...adSetData, startTime: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>End Time</label>
            <input 
              type="datetime-local" 
              value={adSetData.endTime}
              onChange={(e) => setAdSetData({...adSetData, endTime: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Age Min</label>
            <input 
              type="number" 
              value={adSetData.ageMin}
              onChange={(e) => setAdSetData({...adSetData, ageMin: parseInt(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label>Age Max</label>
            <input 
              type="number" 
              value={adSetData.ageMax}
              onChange={(e) => setAdSetData({...adSetData, ageMax: parseInt(e.target.value)})}
            />
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
            <input 
              type="text" 
              value={adData.name}
              onChange={(e) => setAdData({...adData, name: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Creative Name</label>
            <input 
              type="text" 
              value={adData.creativeName}
              onChange={(e) => setAdData({...adData, creativeName: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Select Page</label>
            <select 
              value={adData.pageId}
              onChange={(e) => setAdData({...adData, pageId: e.target.value})}
              required
            >
              <option value="">Select a page</option>
              {pages && pages.map(page => (
                <option key={page.id} value={page.id}>{page.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Website URL</label>
            <input 
              type="url" 
              value={adData.website}
              onChange={(e) => setAdData({...adData, website: e.target.value})}
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Primary Text</label>
            <textarea 
              value={adData.primaryText}
              onChange={(e) => setAdData({...adData, primaryText: e.target.value})}
              rows="3"
              placeholder="Main ad copy that appears above the creative"
              required
            />
          </div>

          <div className="form-group">
            <label>Headline</label>
            <input 
              type="text" 
              value={adData.headline}
              onChange={(e) => setAdData({...adData, headline: e.target.value})}
              placeholder="Headline text"
              maxLength="40"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input 
              type="text" 
              value={adData.description}
              onChange={(e) => setAdData({...adData, description: e.target.value})}
              placeholder="Additional description"
              maxLength="30"
            />
          </div>

          <div className="form-group">
            <label>Media Type</label>
            <select 
              value={adData.mediaType}
              onChange={(e) => setAdData({...adData, mediaType: e.target.value})}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>

          {adData.mediaType === 'image' && (
            <div className="form-group">
              <label>Upload Image</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // Store file for upload
                    setAdData({...adData, imageFile: file});
                  }
                }}
              />
              <small>Or enter image hash if already uploaded</small>
              <input 
                type="text" 
                value={adData.imageHash}
                onChange={(e) => setAdData({...adData, imageHash: e.target.value})}
                placeholder="Image hash"
                style={{ marginTop: '10px' }}
              />
            </div>
          )}

          {adData.mediaType === 'video' && (
            <div className="form-group">
              <label>Upload Video</label>
              <input 
                type="file" 
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // Store file for upload
                    setAdData({...adData, videoFile: file});
                  }
                }}
              />
              <small>Or enter video ID if already uploaded</small>
              <input 
                type="text" 
                value={adData.videoId}
                onChange={(e) => setAdData({...adData, videoId: e.target.value})}
                placeholder="Video ID"
                style={{ marginTop: '10px' }}
              />
            </div>
          )}

          <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
          <button type="submit" className="btn btn-primary">Create Campaign</button>
        </form>
      )}
    </div>
  );
}

export default CreateCampaign;
