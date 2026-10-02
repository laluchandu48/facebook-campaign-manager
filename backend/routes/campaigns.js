const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
  bizSdk, obj, sendError, toMinorUnits, getAccountCurrency, normalizeAdAccountId,
} = require('../lib/facebook');

const { Campaign, AdSet, Ad, AdCreative, AdAccount, AdVideo, FacebookAdsApi } = bizSdk;

router.use(requireAuth);

const OBJECTIVES = ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_AWARENESS'];
const BID_STRATEGIES = ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'];
const CAPPED_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'];
const CALL_TO_ACTIONS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_TRAVEL', 'CONTACT_US', 'DOWNLOAD',
  'GET_OFFER', 'GET_QUOTE', 'SUBSCRIBE', 'APPLY_NOW', 'ORDER_NOW', 'WHATSAPP_MESSAGE',
];

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function toIsoOrUndefined(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid date: ${value}`);
  return date.toISOString();
}

/** Check the request and return clean values, or throw a 400 with a clear message. */
function validate({ campaignData = {}, adSetData = {}, adData = {} }) {
  const errors = [];
  const budgetLevel = campaignData.budgetLevel === 'adset' ? 'adset' : 'campaign';
  const bidStrategy = campaignData.bidStrategy || 'LOWEST_COST_WITHOUT_CAP';

  if (!campaignData.name) errors.push('Campaign name is required');
  if (!OBJECTIVES.includes(campaignData.objective)) errors.push('Choose a valid campaign objective');
  if (!BID_STRATEGIES.includes(bidStrategy)) errors.push('Choose a valid bid strategy');

  const budget = budgetLevel === 'campaign' ? campaignData.dailyBudget : adSetData.dailyBudget;
  if (!budget || Number(budget) <= 0) {
    errors.push(budgetLevel === 'campaign'
      ? 'Campaign daily budget is required'
      : 'Ad set daily budget is required');
  }
  if (CAPPED_STRATEGIES.includes(bidStrategy) && !(Number(adSetData.bidCap) > 0)) {
    errors.push('Bid cap / cost cap amount is required for the selected bid strategy');
  }

  if (!adSetData.name) errors.push('Ad set name is required');
  if (adSetData.performanceGoal === 'OFFSITE_CONVERSIONS' && !adSetData.pixelId) {
    errors.push('A pixel is required when optimising for conversions');
  }
  const countries = (adSetData.countries || [])
    .map(c => String(c).trim().toUpperCase())
    .filter(Boolean);
  if (countries.length === 0) errors.push('Add at least one target country');
  const ageMin = Number(adSetData.ageMin) || 18;
  const ageMax = Number(adSetData.ageMax) || 65;
  if (ageMin < 13 || ageMax > 65 || ageMin > ageMax) errors.push('Age range must be between 13 and 65');

  if (!adData.name) errors.push('Ad name is required');
  if (!adData.pageId) errors.push('Select a Facebook page');
  if (!adData.website) errors.push('Website URL is required');
  if (adData.mediaType === 'video') {
    if (!adData.videoId) errors.push('Upload a video (or enter a video ID)');
  } else if (!adData.imageHash) {
    errors.push('Upload an image (or enter an image hash)');
  }

  if (errors.length) throw badRequest(errors.join('. '));

  return {
    budgetLevel,
    bidStrategy,
    countries,
    ageMin,
    ageMax,
    callToAction: CALL_TO_ACTIONS.includes(adData.callToAction) ? adData.callToAction : 'LEARN_MORE',
    startTime: toIsoOrUndefined(adSetData.startTime),
    endTime: toIsoOrUndefined(adSetData.endTime),
  };
}

// Remove undefined keys so the API never receives "undefined" values.
function clean(params) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
}

router.post('/create', async (req, res) => {
  const created = []; // for rollback if a later step fails
  try {
    const { campaignData, adSetData, adData } = req.body;
    const v = validate(req.body);
    const api = req.fbApi;
    const adAccountId = normalizeAdAccountId(req.body.adAccountId);
    const account = obj(AdAccount, adAccountId, api);
    const currency = await getAccountCurrency(api, adAccountId);

    // 1. Campaign
    const isCbo = v.budgetLevel === 'campaign';
    const campaign = await account.createCampaign([], clean({
      name: campaignData.name,
      objective: campaignData.objective,
      status: 'PAUSED',
      special_ad_categories: Array.isArray(campaignData.specialAdCategories) ? campaignData.specialAdCategories : [],
      buying_type: 'AUCTION',
      // With campaign budget (CBO) the budget and bid strategy live on the campaign.
      daily_budget: isCbo ? toMinorUnits(campaignData.dailyBudget, currency) : undefined,
      bid_strategy: isCbo ? v.bidStrategy : undefined,
      // Required by Meta when the budget is set on the ad sets instead.
      is_adset_budget_sharing_enabled: isCbo ? undefined : false,
    }));
    created.push(obj(Campaign, campaign.id, api));

    // 2. Ad set
    const usesCap = CAPPED_STRATEGIES.includes(v.bidStrategy);
    const adSet = await account.createAdSet([], clean({
      name: adSetData.name,
      campaign_id: campaign.id,
      optimization_goal: adSetData.performanceGoal || 'LINK_CLICKS',
      billing_event: adSetData.billingEvent || 'IMPRESSIONS',
      daily_budget: isCbo ? undefined : toMinorUnits(adSetData.dailyBudget, currency),
      bid_strategy: isCbo ? undefined : v.bidStrategy,
      bid_amount: usesCap ? toMinorUnits(adSetData.bidCap, currency) : undefined,
      start_time: v.startTime,
      end_time: v.endTime,
      targeting: {
        geo_locations: { countries: v.countries },
        age_min: v.ageMin,
        age_max: v.ageMax,
        genders: Array.isArray(adSetData.genders) && adSetData.genders.length === 1 ? adSetData.genders : undefined,
        targeting_automation: { advantage_audience: 0 },
      },
      promoted_object: adSetData.pixelId
        ? { pixel_id: adSetData.pixelId, custom_event_type: adSetData.eventType || 'PURCHASE' }
        : undefined,
      status: 'PAUSED',
    }));

    // 3. Creative
    const cta = { type: v.callToAction, value: { link: adData.website } };
    let objectStorySpec;
    if (adData.mediaType === 'video') {
      let thumbnail = adData.imageHash ? { image_hash: adData.imageHash } : null;
      if (!thumbnail) {
        // video_data needs a thumbnail; fall back to the one Facebook generated.
        const video = await obj(AdVideo, adData.videoId, api).read(['picture']);
        if (!video.picture) throw badRequest('The video is still processing. Wait a minute and try again, or upload a thumbnail image.');
        thumbnail = { image_url: video.picture };
      }
      objectStorySpec = {
        page_id: adData.pageId,
        video_data: clean({
          video_id: adData.videoId,
          message: adData.primaryText,
          title: adData.headline,
          link_description: adData.description,
          call_to_action: cta,
          ...thumbnail,
        }),
      };
    } else {
      objectStorySpec = {
        page_id: adData.pageId,
        link_data: clean({
          message: adData.primaryText,
          link: adData.website,
          name: adData.headline,
          description: adData.description,
          image_hash: adData.imageHash,
          call_to_action: cta,
        }),
      };
    }
    const creative = await account.createAdCreative([], {
      name: adData.creativeName || `${adData.name} creative`,
      object_story_spec: objectStorySpec,
    });
    created.push(obj(AdCreative, creative.id, api));

    // 4. Ad
    const ad = await account.createAd([], {
      name: adData.name,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });

    res.json({
      success: true,
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: creative.id,
      adId: ad.id,
    });
  } catch (error) {
    // Don't leave half-built campaigns behind. Deleting the campaign also removes its ad sets.
    for (const item of created.reverse()) {
      try { await item.delete(); } catch (e) { /* best effort */ }
    }
    sendError(res, error);
  }
});

// ---- Media uploads ----

// Image: sent as base64 JSON, uploaded to the ad account's image library.
router.post('/upload-image', async (req, res) => {
  try {
    const { dataBase64 } = req.body || {};
    if (!dataBase64) return res.status(400).json({ error: 'dataBase64 is required' });
    const bytes = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
    const adAccountId = normalizeAdAccountId(req.body.adAccountId);

    const response = await req.fbApi.call('POST', [adAccountId, 'adimages'], { bytes });
    const image = Object.values(response.images || {})[0];
    if (!image || !image.hash) throw new Error('Upload succeeded but no image hash was returned');
    res.json({ imageHash: image.hash, url: image.url });
  } catch (error) {
    sendError(res, error);
  }
});

// Video: sent as multipart form data, written to a temp file, then streamed to Facebook.
const videoUpload = multer({
  dest: path.join(os.tmpdir(), 'fbcm-uploads'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

router.post('/upload-video', videoUpload.single('video'), async (req, res) => {
  const tmpPath = req.file && req.file.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file received' });
    const adAccountId = normalizeAdAccountId(req.body.adAccountId);

    const form = new FormData();
    form.append('access_token', req.session.accessToken);
    form.append('name', req.file.originalname);
    form.append('source', await fs.openAsBlob(tmpPath, { type: req.file.mimetype }), req.file.originalname);

    const { data } = await axios.post(
      `${FacebookAdsApi.GRAPH_VIDEO}/${FacebookAdsApi.VERSION}/${adAccountId}/advideos`,
      form,
      { maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 10 * 60 * 1000 },
    );
    res.json({ videoId: data.id });
  } catch (error) {
    const fbMessage = error.response?.data?.error?.error_user_msg || error.response?.data?.error?.message;
    sendError(res, fbMessage ? new Error(fbMessage) : error);
  } finally {
    if (tmpPath) fs.promises.unlink(tmpPath).catch(() => {});
  }
});

// Lets the frontend wait until Facebook has finished processing an uploaded video.
router.get('/video-status/:videoId', async (req, res) => {
  try {
    const video = await obj(AdVideo, req.params.videoId, req.fbApi).read(['status', 'picture']);
    res.json({ status: video.status?.video_status || 'unknown', picture: video.picture || null });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
