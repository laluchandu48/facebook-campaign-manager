const express = require('express');
const router = express.Router();
const bizSdk = require('facebook-nodejs-business-sdk');

const AdAccount = bizSdk.AdAccount;
const Campaign = bizSdk.Campaign;
const AdSet = bizSdk.AdSet;
const Ad = bizSdk.Ad;

router.get('/stats', async (req, res) => {
  try {
    const { accessToken, adAccountId, level, datePreset } = req.query;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    const account = new AdAccount(adAccountId);
    
    const insights = await account.getInsights(
      [
        'campaign_id',
        'campaign_name',
        'adset_id',
        'adset_name',
        'ad_id',
        'ad_name',
        'impressions',
        'clicks',
        'spend',
        'reach',
        'frequency',
        'cpc',
        'cpm',
        'ctr',
        'conversions',
        'cost_per_conversion',
        'actions',
        'action_values'
      ],
      {
        level: level || 'campaign',
        date_preset: datePreset || 'last_30d'
      }
    );

    // Fetch status for each entity
    const insightsWithStatus = await Promise.all(insights.map(async (insight) => {
      let status = 'PAUSED';
      let budget = 0;
      
      try {
        if (level === 'campaign' && insight.campaign_id) {
          const campaign = new Campaign(insight.campaign_id);
          const data = await campaign.read(['status', 'daily_budget']);
          status = data.status;
          budget = data.daily_budget / 100; // Convert from cents
        } else if (level === 'adset' && insight.adset_id) {
          const adset = new AdSet(insight.adset_id);
          const data = await adset.read(['status', 'daily_budget']);
          status = data.status;
          budget = data.daily_budget / 100;
        } else if (level === 'ad' && insight.ad_id) {
          const ad = new Ad(insight.ad_id);
          const data = await ad.read(['status']);
          status = data.status;
        }
      } catch (error) {
        console.error('Error fetching status:', error.message);
      }
      
      return { ...insight, status, budget };
    }));

    res.json({ insights: insightsWithStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pause', async (req, res) => {
  try {
    const { accessToken, entityId, entityType } = req.body;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    let entity;
    if (entityType === 'campaign') {
      entity = new Campaign(entityId);
    } else if (entityType === 'adset') {
      entity = new AdSet(entityId);
    } else if (entityType === 'ad') {
      entity = new Ad(entityId);
    }

    await entity.update([], { status: 'PAUSED' });

    res.json({ success: true, message: `${entityType} paused successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/update-budget', async (req, res) => {
  try {
    const { accessToken, entityId, entityType, budget } = req.body;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    let entity;
    if (entityType === 'campaign') {
      entity = new Campaign(entityId);
      await entity.update([], { daily_budget: budget });
    } else if (entityType === 'adset') {
      entity = new AdSet(entityId);
      await entity.update([], { daily_budget: budget });
    }

    res.json({ success: true, message: 'Budget updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
