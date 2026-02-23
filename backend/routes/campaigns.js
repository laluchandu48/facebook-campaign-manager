const express = require('express');
const router = express.Router();
const bizSdk = require('facebook-nodejs-business-sdk');

const Campaign = bizSdk.Campaign;
const AdSet = bizSdk.AdSet;
const Ad = bizSdk.Ad;
const AdCreative = bizSdk.AdCreative;
const AdAccount = bizSdk.AdAccount;

router.post('/create', async (req, res) => {
  try {
    const { accessToken, adAccountId, campaignData, adSetData, adData } = req.body;
    
    bizSdk.FacebookAdsApi.init(accessToken);
    
    const account = new AdAccount(adAccountId);
    
    // Create Campaign
    const campaign = await account.createCampaign([], {
      [Campaign.Fields.name]: campaignData.name,
      [Campaign.Fields.objective]: campaignData.objective,
      [Campaign.Fields.status]: Campaign.Status.paused,
      [Campaign.Fields.special_ad_categories]: [],
      [Campaign.Fields.buying_type]: campaignData.auctionType || 'AUCTION',
      [Campaign.Fields.daily_budget]: campaignData.dailyBudget,
      [Campaign.Fields.bid_strategy]: campaignData.bidStrategy
    });

    // Create AdSet
    const adSet = await account.createAdSet([], {
      [AdSet.Fields.name]: adSetData.name,
      [AdSet.Fields.campaign_id]: campaign.id,
      [AdSet.Fields.optimization_goal]: adSetData.performanceGoal,
      [AdSet.Fields.billing_event]: adSetData.billingEvent || 'IMPRESSIONS',
      [AdSet.Fields.bid_amount]: adSetData.bidCap ? parseInt(adSetData.bidCap) * 100 : undefined,
      [AdSet.Fields.start_time]: adSetData.startTime || undefined,
      [AdSet.Fields.end_time]: adSetData.endTime || undefined,
      [AdSet.Fields.targeting]: {
        geo_locations: adSetData.geoLocations,
        age_min: adSetData.ageMin,
        age_max: adSetData.ageMax,
        genders: adSetData.genders,
        targeting_automation: {
          advantage_audience: 0
        }
      },
      [AdSet.Fields.promoted_object]: adSetData.pixelId ? {
        pixel_id: adSetData.pixelId,
        custom_event_type: adSetData.eventType
      } : undefined,
      [AdSet.Fields.status]: AdSet.Status.paused
    });

    // Create Ad Creative
    const creative = await account.createAdCreative([], {
      [AdCreative.Fields.name]: adData.creativeName,
      [AdCreative.Fields.object_story_spec]: {
        page_id: adData.pageId,
        link_data: {
          message: adData.primaryText,
          link: adData.website,
          name: adData.headline,
          description: adData.description,
          image_hash: adData.imageHash || undefined,
          video_id: adData.videoId || undefined,
          call_to_action: {
            type: 'LEARN_MORE'
          }
        }
      }
    });

    // Create Ad
    const ad = await account.createAd([], {
      [Ad.Fields.name]: adData.name,
      [Ad.Fields.adset_id]: adSet.id,
      [Ad.Fields.creative]: { creative_id: creative.id },
      [Ad.Fields.status]: Ad.Status.paused
    });

    res.json({
      success: true,
      campaign: campaign,
      adSet: adSet,
      ad: ad
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
