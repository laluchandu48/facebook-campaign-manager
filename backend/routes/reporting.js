const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
  bizSdk, obj, fetchAll, sendError, toMinorUnits, fromMinorUnits, getAccountCurrency, normalizeAdAccountId,
} = require('../lib/facebook');

const { AdAccount, Campaign, AdSet, Ad } = bizSdk;

router.use(requireAuth);

const LEVELS = ['campaign', 'adset', 'ad'];
const DATE_PRESETS = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'this_month', 'last_month', 'maximum'];
const ENTITY_CLASSES = { campaign: Campaign, adset: AdSet, ad: Ad };

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

const INSIGHT_FIELDS = [
  'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
  'impressions', 'clicks', 'spend', 'reach', 'frequency', 'cpc', 'cpm', 'ctr',
  'actions', 'cost_per_action_type', 'action_values',
];

router.get('/stats', async (req, res) => {
  try {
    const level = LEVELS.includes(req.query.level) ? req.query.level : 'campaign';
    // 'lifetime' is what the old UI sent; the API calls it 'maximum'.
    const requestedPreset = req.query.datePreset === 'lifetime' ? 'maximum' : req.query.datePreset;
    const datePreset = DATE_PRESETS.includes(requestedPreset) ? requestedPreset : 'last_30d';
    const adAccountId = normalizeAdAccountId(req.query.adAccountId);
    const account = obj(AdAccount, adAccountId, req.fbApi);

    // Insights, the account currency, and the status/budget of every entity at this
    // level are fetched in three bulk calls, instead of one extra call per row.
    const entityFields = level === 'ad'
      ? ['id', 'status', 'effective_status']
      : ['id', 'status', 'effective_status', 'daily_budget', 'lifetime_budget'];
    const entityEdge = { campaign: 'getCampaigns', adset: 'getAdSets', ad: 'getAds' }[level];

    const [insights, currency, entities] = await Promise.all([
      account.getInsights(INSIGHT_FIELDS, { level, date_preset: datePreset, limit: 500 }).then(c => fetchAll(c)),
      getAccountCurrency(req.fbApi, adAccountId),
      account[entityEdge](entityFields, { limit: 500 }).then(c => fetchAll(c)),
    ]);

    const byId = new Map(entities.map(e => [e.id, e]));
    const rows = insights.map(insight => {
      const id = insight[`${level}_id`];
      const entity = byId.get(id) || {};
      const dailyBudget = fromMinorUnits(entity.daily_budget, currency);
      const lifetimeBudget = fromMinorUnits(entity.lifetime_budget, currency);
      return {
        ...insight,
        id,
        name: insight[`${level}_name`],
        status: entity.status || 'UNKNOWN',
        effectiveStatus: entity.effective_status || null,
        // Budget is null when it is set at the other level (campaign vs ad set).
        budget: dailyBudget || lifetimeBudget || null,
        budgetType: dailyBudget ? 'daily' : lifetimeBudget ? 'lifetime' : null,
      };
    });

    res.json({ insights: rows, currency, level, datePreset });
  } catch (error) {
    sendError(res, error);
  }
});

async function setStatus(req, res, status) {
  try {
    const { entityId, entityType } = req.body || {};
    const Klass = ENTITY_CLASSES[entityType];
    if (!Klass || !entityId) throw badRequest('entityId and a valid entityType (campaign, adset, ad) are required');
    await obj(Klass, entityId, req.fbApi).update([], { status });
    res.json({ success: true, status, message: `${entityType} ${status === 'PAUSED' ? 'paused' : 'activated'}` });
  } catch (error) {
    sendError(res, error);
  }
}

router.post('/pause', (req, res) => setStatus(req, res, 'PAUSED'));
router.post('/activate', (req, res) => setStatus(req, res, 'ACTIVE'));

/**
 * Body: { adAccountId, entityId, entityType: 'campaign' | 'adset', budget }
 * `budget` is in normal currency units (e.g. 500 for INR 500); it is converted
 * to the API's minor units here. Daily or lifetime is detected automatically.
 */
router.post('/update-budget', async (req, res) => {
  try {
    const { entityId, entityType, budget } = req.body || {};
    if (!['campaign', 'adset'].includes(entityType) || !entityId) {
      throw badRequest('entityId and entityType (campaign or adset) are required');
    }
    const currency = await getAccountCurrency(req.fbApi, normalizeAdAccountId(req.body.adAccountId));
    const amount = toMinorUnits(budget, currency);

    const entity = obj(ENTITY_CLASSES[entityType], entityId, req.fbApi);
    const current = await entity.read(['daily_budget', 'lifetime_budget']);
    let field;
    if (Number(current.daily_budget) > 0) field = 'daily_budget';
    else if (Number(current.lifetime_budget) > 0) field = 'lifetime_budget';
    else {
      throw badRequest(entityType === 'campaign'
        ? 'This campaign has no campaign-level budget. Change the budget on its ad sets instead.'
        : 'This ad set has no budget of its own (the campaign budget is used). Change the campaign budget instead.');
    }

    await obj(ENTITY_CLASSES[entityType], entityId, req.fbApi).update([], { [field]: amount });
    res.json({ success: true, field, budget: fromMinorUnits(amount, currency), currency });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
